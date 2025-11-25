import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: true,
  });
  
  // Tăng giới hạn body size cho upload ảnh base64
  app.use(require('express').json({ limit: '10mb' }));
  app.use(require('express').urlencoded({ limit: '10mb', extended: true }));
  
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
  );
  app.enableCors({
    origin: ['http://localhost:4200'],
    credentials: false,
  });
  const uploadsPath = join(process.cwd(), 'uploads');
  if (!existsSync(uploadsPath)) mkdirSync(uploadsPath, { recursive: true });
  app.useStaticAssets(uploadsPath, { prefix: '/uploads/' });
  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
}
bootstrap();
