import { registerAs } from '@nestjs/config';

import { NodeEnvironment } from './environment';

export interface AppConfig {
  environment: NodeEnvironment;
  port: number;
  corsOrigins: string[];
  appUrl: string;
  logLevel: string;
  cookieDomain?: string;
  isProduction: boolean;
}

export interface GoogleConfig {
  clientId: string;
  isEnabled: boolean;
}

export interface JwtConfig {
  accessSecret: string;
  refreshSecret: string;
  accessTtl: string;
  refreshTtl: string;
}

export interface MailConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
  isEnabled: boolean;
}

export interface AssistantConfig {
  apiKey: string;
  model: string;
  isEnabled: boolean;
}

export const appConfig = registerAs<AppConfig>('app', () => {
  const environment = (process.env.NODE_ENV as NodeEnvironment) ?? NodeEnvironment.Development;

  return {
    environment,
    port: Number(process.env.PORT ?? 4200),
    corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3200')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    appUrl: process.env.APP_URL ?? 'http://localhost:3200',
    logLevel: process.env.LOG_LEVEL ?? 'info',
    cookieDomain: process.env.COOKIE_DOMAIN || undefined,
    isProduction: environment === NodeEnvironment.Production,
  };
});

export const googleConfig = registerAs<GoogleConfig>('google', () => {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? '';

  return { clientId, isEnabled: clientId.length > 0 };
});

export const jwtConfig = registerAs<JwtConfig>('jwt', () => ({
  accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
  refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
  accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
  refreshTtl: process.env.JWT_REFRESH_TTL ?? '30d',
}));

export const mailConfig = registerAs<MailConfig>('mail', () => {
  const host = process.env.SMTP_HOST ?? '';

  return {
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER ?? '',
    password: process.env.SMTP_PASSWORD ?? '',
    from: process.env.MAIL_FROM ?? 'Personal Planner <no-reply@planner.local>',
    isEnabled: host.length > 0,
  };
});

export const assistantConfig = registerAs<AssistantConfig>('assistant', () => {
  const apiKey = process.env.ANTHROPIC_API_KEY ?? '';

  return {
    apiKey,
    model: process.env.ANTHROPIC_MODEL || 'claude-opus-5-5',
    isEnabled: apiKey.length > 0,
  };
});
