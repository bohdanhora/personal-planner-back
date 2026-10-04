import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import {
  appConfig,
  assistantConfig,
  googleConfig,
  jwtConfig,
  mailConfig,
  type AppConfig,
} from './config/app.config';
import { validateEnvironment } from './config/environment';
import { AssistantModule } from './modules/assistant/assistant.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { InsightsModule } from './modules/insights/insights.module';
import { MailModule } from './modules/mail/mail.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './prisma/prisma.module';

const GLOBAL_RATE_LIMIT = { ttl: 60_000, limit: 300 };

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment,
      load: [appConfig, jwtConfig, googleConfig, mailConfig, assistantConfig],
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const config = configService.getOrThrow<AppConfig>('app');

        return {
          pinoHttp: {
            level: config.logLevel,
            transport: config.isProduction ? undefined : { target: 'pino-pretty' },
            redact: ['req.headers.authorization', 'req.headers.cookie'],
            autoLogging: { ignore: (request) => request.url === '/api/health' },
          },
        };
      },
    }),
    ThrottlerModule.forRoot({ throttlers: [GLOBAL_RATE_LIMIT] }),
    PrismaModule,
    MailModule,
    HealthModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    TasksModule,
    InsightsModule,
    AssistantModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
