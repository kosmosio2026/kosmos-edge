import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { join } from 'path';
import * as express from 'express';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use('/uploads', express.static(join(process.cwd(), '../../uploads')));

  const config = app.get(ConfigService);

  /**
   * Frontend uses 4000.
   * Local/default API port is 3000.
   * Nginx can proxy /api to this API process.
   *
   * Priority:
   * 1. PORT - deployment/runtime override
   * 2. API_PORT - local/app config
   * 3. 3000 - default API port
   */
  const port = Number(
    process.env.PORT ??
      config.get<number>('API_PORT') ??
      3000,
  );

  app.setGlobalPrefix('api');

  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Parking Platform API')
    .setDescription('Edge-first smart parking platform API')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  await app.listen(port, '0.0.0.0');

  console.log(`API running on http://0.0.0.0:${port}`);
}

bootstrap();