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
  p99: number;
  min: number;
  max: number;
};

function readPositiveInt(envName: string, fallback: number): number {
  const raw = process.env[envName];
  const parsed = raw ? Number(raw) : fallback;
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function readPositiveNumber(envName: string, fallback: number): number {
  const raw = process.env[envName];
  const parsed = raw ? Number(raw) : fallback;
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function readNonNegativeInt(envName: string, fallback: number): number {
  const raw = process.env[envName];
  const parsed = raw ? Number(raw) : fallback;
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.floor(parsed);
}

function extractCookieValue(
  setCookies: string | string[] | undefined,
  name: string,
): string | null {
  if (!setCookies) return null;
  const rows = Array.isArray(setCookies) ? setCookies : [setCookies];
  if (rows.length === 0) return null;
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
  if (!values.length) {
    return { avg: 0, p50: 0, p95: 0, p99: 0, min: 0, max: 0 };
  }
  const sum = values.reduce((acc, v) => acc + v, 0);
  return {
    avg: sum / values.length,
    p50: percentile(values, 50),
    p95: percentile(values, 95),
    p99: percentile(values, 99),
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

function formatMs(ms: number): string {
  return `${ms.toFixed(2)}ms`;
}

describe('Class scale load (perf)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let replSet: MongoMemoryReplSet;

  let userModel: Model<any>;
  let studentModel: Model<any>;
  let classModel: Model<any>;

  let directorSession: SessionCookies;
  let seededClassIdForSanity: string;

  const PERF_CLASS_COUNT = readPositiveInt('PERF_CLASS_COUNT', 220);
  const PERF_STUDENTS_PER_CLASS = readPositiveInt('PERF_STUDENTS_PER_CLASS', 12);
  const PERF_TEACHER_COUNT = readPositiveInt('PERF_TEACHER_COUNT', 10);
  const PERF_ROUNDS = readPositiveInt('PERF_ROUNDS', 5);
  const PERF_BURST_REQUESTS = readPositiveInt('PERF_BURST_REQUESTS', 10);
  const PERF_BURST_CONCURRENCY = readPositiveInt('PERF_BURST_CONCURRENCY', 2);
  const PERF_BURST_RETRY_COUNT = readNonNegativeInt('PERF_BURST_RETRY_COUNT', 1);
  const PERF_MAX_BURST_ERRORS = readNonNegativeInt('PERF_MAX_BURST_ERRORS', 0);

  const PERF_MAX_P95_CLASSES_MS = readPositiveNumber('PERF_MAX_P95_CLASSES_MS', 2500);
  const PERF_MAX_P95_CLASSES_WITH_STUDENTS_MS = readPositiveNumber(
    'PERF_MAX_P95_CLASSES_WITH_STUDENTS_MS',
    3000,
  );
  const PERF_MAX_P95_BURST_MS = readPositiveNumber('PERF_MAX_P95_BURST_MS', 4500);

  async function upsertUser(payload: {
    email: string;
    fullName: string;
    role: string;
    passwordHash: string;
  }): Promise<any> {
    await userModel.updateOne(
      { email: payload.email },
      {
        $set: {
          email: payload.email,
          password: payload.passwordHash,
          fullName: payload.fullName,
          role: payload.role,
          status: 'ACTIVE',
        },
      },
      { upsert: true },
    );
    return userModel.findOne({ email: payload.email }).lean() as any;
  }

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

  function authGet(agent: any, session: SessionCookies): any {
    return agent.set('Cookie', session.cookieHeader);
  }

  async function measureRepeated(
    label: string,
    rounds: number,
    requestFactory: () => Promise<any>,
  ): Promise<{ metrics: PerfMetrics; payloadBytes: number; sampleBody: any }> {
    const latencies: number[] = [];
    let payloadBytes = 0;
    let sampleBody: any = null;

    for (let i = 0; i < rounds; i += 1) {
      const started = process.hrtime.bigint();
      const res = await requestFactory();
      const elapsedMs = Number(process.hrtime.bigint() - started) / 1_000_000;
      latencies.push(elapsedMs);
      sampleBody = res.body;
      payloadBytes = Buffer.byteLength(JSON.stringify(res.body ?? {}), 'utf8');
    }

    const metrics = summarize(latencies);
    console.log(
      `[perf] ${label} | rounds=${rounds} | avg=${formatMs(metrics.avg)} | p95=${formatMs(
        metrics.p95,
      )} | max=${formatMs(metrics.max)} | payload=${payloadBytes} bytes`,
    );

    return { metrics, payloadBytes, sampleBody };
  }

  async function measureConcurrent(
    label: string,
    totalRequests: number,
    concurrency: number,
    requestFactory: () => Promise<any>,
  ): Promise<{ metrics: PerfMetrics; errorCount: number }> {
    const latencies: number[] = [];
    let errorCount = 0;
    const sampleErrors: string[] = [];
    let cursor = 0;

    async function worker() {
      while (true) {
        const idx = cursor;
        cursor += 1;
        if (idx >= totalRequests) break;

        const started = process.hrtime.bigint();
        let done = false;
        let attempts = 0;
        while (!done) {
          attempts += 1;
          try {
            await requestFactory();
            const elapsedMs = Number(process.hrtime.bigint() - started) / 1_000_000;
            latencies.push(elapsedMs);
            done = true;
          } catch (error) {
            if (attempts > PERF_BURST_RETRY_COUNT + 1) {
              errorCount += 1;
              if (sampleErrors.length < 3) {
                sampleErrors.push(error instanceof Error ? error.message : String(error));
              }
              done = true;
            }
          }
        }
      }
    }

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    const metrics = summarize(latencies);
    console.log(
      `[perf] ${label} | requests=${totalRequests} | concurrency=${concurrency} | avg=${formatMs(
        metrics.avg,
      )} | p95=${formatMs(metrics.p95)} | max=${formatMs(metrics.max)} | errors=${errorCount}`,
    );
    if (sampleErrors.length > 0) {
      console.log(`[perf] ${label} sample errors: ${sampleErrors.join(' | ')}`);
    }
    return { metrics, errorCount };
  }

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    process.env.MONGODB_URI = replSet.getUri('school-mgmt-class-scale-perf');

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

    const password = 'PerfPass123!';
    const passwordHash = await bcrypt.hash(password, 10);
    const seedTag = Date.now().toString().slice(-6);

    const director = (await upsertUser({
      email: `director.perf.${seedTag}@school.local`,
      fullName: 'Director Perf',
      role: 'DIRECTOR',
      passwordHash,
    })) as any;
    const parent = (await upsertUser({
      email: `parent.perf.${seedTag}@school.local`,
      fullName: 'Parent Perf',
      role: 'PARENT',
      passwordHash,
    })) as any;

    const teacherPayload = Array.from({ length: PERF_TEACHER_COUNT }, (_, i) => ({
      email: `teacher.${seedTag}.${i}@school.local`,
      password: passwordHash,
      fullName: `Teacher Perf ${i + 1}`,
      role: 'TEACHER',
      status: 'ACTIVE',
    }));
    const teacherDocs = await userModel.insertMany(teacherPayload);
    const teacherIds = teacherDocs.map((t: any) => t._id);

    const totalStudents = PERF_CLASS_COUNT * PERF_STUDENTS_PER_CLASS;
    const studentPayload = Array.from({ length: totalStudents }, (_, i) => ({
      studentCode: `PERF-STU-${seedTag}-${String(i + 1).padStart(5, '0')}`,
      fullName: `Perf Student ${i + 1}`,
      age: 10 + (i % 6),
      parentUserId: new Types.ObjectId(parent._id),
      parentName: 'Parent Perf',
      parentPhone: `090${String(i).padStart(7, '0')}`.slice(0, 10),
      faceImage: 'seed-face-perf.jpg',
      approvalStatus: 'APPROVED',
      approvedBy: new Types.ObjectId(director._id),
      approvedAt: new Date(),
      subjects: ['Toan'],
      grade: '5',
    }));
    const studentDocs = await studentModel.insertMany(studentPayload);
    const studentIds = studentDocs.map((s: any) => s._id);

    const classPayload = Array.from({ length: PERF_CLASS_COUNT }, (_, i) => {
      const from = i * PERF_STUDENTS_PER_CLASS;
      const to = from + PERF_STUDENTS_PER_CLASS;
      return {
        name: `Perf Class ${i + 1}`,
        code: `PERF-CLS-${seedTag}-${String(i + 1).padStart(5, '0')}`,
        teacher: new Types.ObjectId(teacherIds[i % teacherIds.length]),
        students: studentIds.slice(from, to).map((sid: any) => new Types.ObjectId(sid)),
        classMode: i % 2 === 0 ? 'ONLINE' : 'OFFLINE',
        pricePerSession: 180000,
        teacherPayPerSession: 90000,
        teacherPayPerStudent: 50000,
        baseDuration: 60,
        sessionDuration: 60,
        status: 'ACTIVE',
      };
    });
    const classDocs = await classModel.insertMany(classPayload);
    seededClassIdForSanity = String(classDocs[0]?._id || '');

    directorSession = await loginAndGetSession(String(director.email), password);

    console.log(
      `[perf] dataset ready | classes=${PERF_CLASS_COUNT}, students=${totalStudents}, teachers=${PERF_TEACHER_COUNT}, perClass=${PERF_STUDENTS_PER_CLASS}`,
    );
  });

  afterAll(async () => {
    await app.close();
    await replSet.stop();
  });

  it('seeds expected large class dataset', async () => {
    const classCount = await classModel.countDocuments();
    const studentCount = await studentModel.countDocuments();

    expect(classCount).toBe(PERF_CLASS_COUNT);
    expect(studentCount).toBe(PERF_CLASS_COUNT * PERF_STUDENTS_PER_CLASS);
    expect(seededClassIdForSanity).toBeTruthy();
  });

  it('measures GET /classes latency on large class volume', async () => {
    const measured = await measureRepeated(
      'GET /classes',
      PERF_ROUNDS,
      () => authGet(request(app.getHttpServer()).get('/classes'), directorSession).expect(200),
    );

    expect(Array.isArray(measured.sampleBody)).toBe(true);
    expect(measured.sampleBody.length).toBe(PERF_CLASS_COUNT);
    expect(measured.metrics.p95).toBeLessThan(PERF_MAX_P95_CLASSES_MS);
  });

  it('measures GET /attendance/classes-with-students latency on large class volume', async () => {
    const measured = await measureRepeated(
      'GET /attendance/classes-with-students',
      PERF_ROUNDS,
      () =>
        authGet(
          request(app.getHttpServer()).get('/attendance/classes-with-students'),
          directorSession,
        ).expect(200),
    );

    expect(Array.isArray(measured.sampleBody)).toBe(true);
    expect(measured.sampleBody.length).toBe(PERF_CLASS_COUNT);
    expect(measured.metrics.p95).toBeLessThan(PERF_MAX_P95_CLASSES_WITH_STUDENTS_MS);
  });

  it('measures concurrent GET /classes burst under large class volume', async () => {
    const measured = await measureConcurrent(
      'GET /classes burst',
      PERF_BURST_REQUESTS,
      PERF_BURST_CONCURRENCY,
      () => authGet(request(app.getHttpServer()).get('/classes'), directorSession).expect(200),
    );

    expect(measured.metrics.p95).toBeLessThan(PERF_MAX_P95_BURST_MS);
    expect(measured.errorCount).toBeLessThanOrEqual(PERF_MAX_BURST_ERRORS);
  });
});
