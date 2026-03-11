import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';

type SessionCookies = {
  accessToken: string;
  xsrfToken: string;
  cookieHeader: string;
};

type PerfMetrics = {
  avg: number;
  p50: number;
  p95: number;
  max: number;
};

function readPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = raw ? Number(raw) : fallback;
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function readNonNegativeInt(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = raw ? Number(raw) : fallback;
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.floor(parsed);
}

function dateYmdFromBase(base: Date, offsetDays: number): string {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function extractCookieValue(
  setCookies: string | string[] | undefined,
  name: string,
): string | null {
  if (!setCookies) return null;
  const rows = Array.isArray(setCookies) ? setCookies : [setCookies];
  const pattern = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`);
  for (const row of rows) {
    const firstPart = String(row).split(';')[0];
    const match = pattern.exec(firstPart);
    if (match?.[1]) return match[1];
  }
  return null;
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function summarize(values: number[]): PerfMetrics {
  if (!values.length) return { avg: 0, p50: 0, p95: 0, max: 0 };
  const sum = values.reduce((acc, v) => acc + v, 0);
  return {
    avg: sum / values.length,
    p50: percentile(values, 50),
    p95: percentile(values, 95),
    max: Math.max(...values),
  };
}

describe('Attendance throughput (perf)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let replSet: MongoMemoryReplSet;

  let userModel: Model<any>;
  let studentModel: Model<any>;
  let classModel: Model<any>;

  const PERF_ATT_STUDENT_COUNT = readPositiveInt('PERF_ATT_STUDENT_COUNT', 150);
  const PERF_ATT_TOTAL_REQUESTS = readPositiveInt('PERF_ATT_TOTAL_REQUESTS', 900);
  const PERF_ATT_CONCURRENCY = readPositiveInt('PERF_ATT_CONCURRENCY', 4);
  const PERF_ATT_RETRY_COUNT = readNonNegativeInt('PERF_ATT_RETRY_COUNT', 1);
  const PERF_ATT_MAX_FAILED = readNonNegativeInt('PERF_ATT_MAX_FAILED', 0);

  const seedTag = Date.now().toString().slice(-6);
  const baseDate = new Date(Date.UTC(2030, 0, 1));

  let classId = '';
  let studentIds: string[] = [];
  let opsSession: SessionCookies;

  async function loginAndGetSession(email: string, password: string): Promise<SessionCookies> {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    const accessToken = extractCookieValue(loginRes.headers['set-cookie'], 'access_token');
    expect(accessToken).toBeTruthy();

    const meRes = await request(app.getHttpServer())
      .get('/users/me')
      .set('Cookie', `access_token=${accessToken}`)
      .expect(200);
    const xsrfToken = extractCookieValue(meRes.headers['set-cookie'], 'XSRF-TOKEN');
    expect(xsrfToken).toBeTruthy();

    return {
      accessToken: accessToken as string,
      xsrfToken: xsrfToken as string,
      cookieHeader: `access_token=${accessToken}; XSRF-TOKEN=${xsrfToken}`,
    };
  }

  function authWrite(agent: any, session: SessionCookies): any {
    return agent.set('Cookie', session.cookieHeader).set('X-XSRF-TOKEN', session.xsrfToken);
  }

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    process.env.MONGODB_URI = replSet.getUri('school-mgmt-att-throughput-perf');

    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.use(require('express').json({ limit: '10mb' }));
    app.use(require('express').urlencoded({ limit: '10mb', extended: true }));
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    userModel = moduleRef.get<Model<any>>(getModelToken('User'));
    studentModel = moduleRef.get<Model<any>>(getModelToken('Student'));
    classModel = moduleRef.get<Model<any>>(getModelToken('Classroom'));

    const rawPassword = 'PerfAttPass123!';
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    const ops = await userModel.create({
      email: `ops.att.perf.${seedTag}@school.local`,
      password: hashedPassword,
      fullName: 'Ops Attendance Perf',
      role: 'OPS',
      status: 'ACTIVE',
    });
    const teacher = await userModel.create({
      email: `teacher.att.perf.${seedTag}@school.local`,
      password: hashedPassword,
      fullName: 'Teacher Attendance Perf',
      role: 'TEACHER',
      status: 'ACTIVE',
    });
    const parent = await userModel.create({
      email: `parent.att.perf.${seedTag}@school.local`,
      password: hashedPassword,
      fullName: 'Parent Attendance Perf',
      role: 'PARENT',
      status: 'ACTIVE',
    });

    const students = await studentModel.insertMany(
      Array.from({ length: PERF_ATT_STUDENT_COUNT }, (_, i) => ({
        studentCode: `ATTPERF-${seedTag}-${String(i + 1).padStart(4, '0')}`,
        fullName: `ATTPERF Student ${i + 1}`,
        age: 10 + (i % 5),
        parentUserId: new Types.ObjectId(parent._id),
        parentName: 'Perf Parent',
        parentPhone: `091${String(i).padStart(7, '0')}`.slice(0, 10),
        faceImage: 'seed-face-perf.jpg',
        approvalStatus: 'APPROVED',
        approvedBy: new Types.ObjectId(ops._id),
        approvedAt: new Date(),
        subjects: ['Toan'],
        grade: '5',
      })),
    );
    studentIds = students.map((s: any) => String(s._id));

    const cls = await classModel.create({
      name: `ATTPERF CLASS ${seedTag}`,
      code: `ATTPERF-${seedTag}`,
      teacher: new Types.ObjectId(teacher._id),
      students: studentIds.map((id) => new Types.ObjectId(id)),
      classMode: 'OFFLINE',
      pricePerSession: 120000,
      teacherPayPerSession: 80000,
      teacherPayPerStudent: 60000,
      baseDuration: 60,
      sessionDuration: 60,
      status: 'ACTIVE',
    });
    classId = String(cls._id);

    opsSession = await loginAndGetSession(String(ops.email), rawPassword);
  });

  afterAll(async () => {
    await app.close();
    await replSet.stop();
  });

  it('estimates attendance sessions per hour for current codebase', async () => {
    let cursor = 0;
    const latencies: number[] = [];
    let success = 0;
    let failed = 0;
    let sessionCreatedCount = 0;
    const sampleErrors: string[] = [];

    async function worker() {
      while (true) {
        const idx = cursor;
        cursor += 1;
        if (idx >= PERF_ATT_TOTAL_REQUESTS) break;

        const studentId = studentIds[idx % studentIds.length];
        const dayBucket = Math.floor(idx / studentIds.length) + 1;
        const date = dateYmdFromBase(baseDate, dayBucket);

        let done = false;
        let attempts = 0;
        const started = process.hrtime.bigint();
        while (!done) {
          attempts += 1;
          try {
            const res = await authWrite(
              request(app.getHttpServer()).post('/attendance/mark'),
              opsSession,
            )
              .send({
                classId,
                studentId,
                date,
                status: 'PRESENT',
                notes: 'throughput-bench',
              })
              .expect((r) => {
                expect([200, 201]).toContain(r.status);
              });
            success += 1;
            if (res.body?.sessionCreated === true) sessionCreatedCount += 1;
            const elapsedMs = Number(process.hrtime.bigint() - started) / 1_000_000;
            latencies.push(elapsedMs);
            done = true;
          } catch (error) {
            if (attempts > PERF_ATT_RETRY_COUNT + 1) {
              failed += 1;
              if (sampleErrors.length < 5) {
                sampleErrors.push(error instanceof Error ? error.message : String(error));
              }
              done = true;
            }
          }
        }
      }
    }

    const started = process.hrtime.bigint();
    await Promise.all(
      Array.from({ length: PERF_ATT_CONCURRENCY }, () => worker()),
    );
    const totalElapsedSec = Number(process.hrtime.bigint() - started) / 1_000_000_000;

    const metrics = summarize(latencies);
    const throughputPerSec = success / totalElapsedSec;
    const estimatedPerHour = throughputPerSec * 3600;

    console.log(
      `[perf][attendance] requests=${PERF_ATT_TOTAL_REQUESTS} success=${success} failed=${failed} ` +
        `concurrency=${PERF_ATT_CONCURRENCY} retries=${PERF_ATT_RETRY_COUNT} elapsed=${totalElapsedSec.toFixed(2)}s`,
    );
    console.log(
      `[perf][attendance] throughput=${throughputPerSec.toFixed(2)} session/s ` +
        `=> ${Math.round(estimatedPerHour).toLocaleString()} session/h`,
    );
    console.log(
      `[perf][attendance] latency avg=${metrics.avg.toFixed(2)}ms p50=${metrics.p50.toFixed(
        2,
      )}ms p95=${metrics.p95.toFixed(2)}ms max=${metrics.max.toFixed(2)}ms`,
    );
    console.log(`[perf][attendance] sessionCreated=${sessionCreatedCount}`);
    if (sampleErrors.length > 0) {
      console.log(`[perf][attendance] sampleErrors=${sampleErrors.join(' | ')}`);
    }

    expect(success + failed).toBe(PERF_ATT_TOTAL_REQUESTS);
    expect(failed).toBeLessThanOrEqual(PERF_ATT_MAX_FAILED);
    expect(sessionCreatedCount).toBe(success);
  });
});
