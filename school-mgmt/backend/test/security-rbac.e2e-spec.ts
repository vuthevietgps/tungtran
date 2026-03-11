import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';

type SessionCookies = {
  accessToken: string;
  xsrfToken: string;
  cookieHeader: string;
};

type SeedUser = {
  email: string;
  password: string;
  fullName: string;
  role: 'DIRECTOR' | 'PARENT';
};

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

describe('Security and RBAC (e2e)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let mongod: MongoMemoryServer;
  let userModel: Model<any>;

  const director: SeedUser = {
    email: 'director.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Director E2E',
    role: 'DIRECTOR',
  };

  const parent: SeedUser = {
    email: 'parent.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Parent E2E',
    role: 'PARENT',
  };

  async function upsertUser(user: SeedUser): Promise<void> {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    await userModel.updateOne(
      { email: user.email },
      {
        $set: {
          email: user.email,
          password: hashedPassword,
          fullName: user.fullName,
          role: user.role,
          status: 'ACTIVE',
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true },
    );
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

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri('school-mgmt-e2e');

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
    await upsertUser(director);
    await upsertUser(parent);
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  it('logs in and issues access + XSRF cookies across login/me flow', async () => {
    const session = await loginAndGetSession(director.email, director.password);
    expect(session.accessToken.length).toBeGreaterThan(10);
    expect(session.xsrfToken.length).toBeGreaterThan(10);
  });

  it('rejects state-changing request without X-XSRF-TOKEN header', async () => {
    const session = await loginAndGetSession(director.email, director.password);
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', session.cookieHeader)
      .expect(403);
  });

  it('accepts state-changing request when CSRF cookie/header match', async () => {
    const session = await loginAndGetSession(director.email, director.password);
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', session.cookieHeader)
      .set('X-XSRF-TOKEN', session.xsrfToken)
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });
  });

  it('enforces RBAC on /users endpoint', async () => {
    const parentSession = await loginAndGetSession(parent.email, parent.password);
    await request(app.getHttpServer())
      .get('/users')
      .set('Cookie', parentSession.cookieHeader)
      .expect(403);

    const directorSession = await loginAndGetSession(director.email, director.password);
    const res = await request(app.getHttpServer())
      .get('/users')
      .set('Cookie', directorSession.cookieHeader)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });
});
