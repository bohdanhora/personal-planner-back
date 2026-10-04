import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { appConfig, type AppConfig } from './config/app.config';

const API_PREFIX = 'api';
const DOCS_PATH = 'api/docs';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const logger = app.get(Logger);

  app.useLogger(logger);
  app.setGlobalPrefix(API_PREFIX);
  app.use(helmet());
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  const config = app.get<AppConfig>(appConfig.KEY);

  if (config.isProduction) {
    app.set('trust proxy', 1);
  }

  app.enableCors({ origin: config.corsOrigins, credentials: true });

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Personal Planner API')
      .setDescription(
        'Daily planning for work and personal life. Dates are calendar days in YYYY-MM-DD, times are minutes after midnight.',
      )
      .setVersion('0.1.0')
      .addBearerAuth()
      .build(),
  );

  SwaggerModule.setup(DOCS_PATH, app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(config.port);
  logger.log(`Personal Planner API listening on port ${config.port}`);
}

void bootstrap();
