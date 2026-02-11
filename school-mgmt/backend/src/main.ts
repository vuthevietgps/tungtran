import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false, // Disable default parser to use custom limit below
  });

  const config = app.get(ConfigService);

  // Security headers
  app.use(helmet());

  // Cookie parser for httpOnly JWT tokens
  app.use(cookieParser());

  // Custom body parser with 10mb limit for base64 uploads
  app.use(require('express').json({ limit: '10mb' }));
  app.use(require('express').urlencoded({ limit: '10mb', extended: true }));

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  const corsOrigin = config.get<string>('CORS_ORIGIN', 'http://localhost:4200');
  app.enableCors({
    origin: corsOrigin.split(',').map(o => o.trim()),
    credentials: true, // Allow cookies to be sent with requests
  });

  const uploadsPath = join(process.cwd(), 'uploads');
  if (!existsSync(uploadsPath)) mkdirSync(uploadsPath, { recursive: true });

  // Serve static files from uploads directory
  app.useStaticAssets(uploadsPath, {
    prefix: '/uploads/',
  });

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
}
bootstrap();
