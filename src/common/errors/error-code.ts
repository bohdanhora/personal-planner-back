import { HttpException, HttpStatus } from '@nestjs/common';

export enum ErrorCode {
  EmailTaken = 'EMAIL_TAKEN',
  EmailNotVerified = 'EMAIL_NOT_VERIFIED',
  InvalidCredentials = 'INVALID_CREDENTIALS',
  InvalidCode = 'INVALID_CODE',
  CodeExpired = 'CODE_EXPIRED',
  TooManyAttempts = 'TOO_MANY_ATTEMPTS',
  ResendTooSoon = 'RESEND_TOO_SOON',
  SessionExpired = 'SESSION_EXPIRED',
  GoogleUnavailable = 'GOOGLE_UNAVAILABLE',
  GoogleRejected = 'GOOGLE_REJECTED',
  ProjectCodeTaken = 'PROJECT_CODE_TAKEN',
  ProjectNotFound = 'PROJECT_NOT_FOUND',
  TaskNotFound = 'TASK_NOT_FOUND',
  AssistantDisabled = 'ASSISTANT_DISABLED',
  AssistantFailed = 'ASSISTANT_FAILED',
  AssistantBusy = 'ASSISTANT_BUSY',
}

const raise = (status: HttpStatus, code: ErrorCode, message: string): HttpException =>
  new HttpException({ code, message, error: HttpStatus[status] }, status);

export const badRequest = (code: ErrorCode, message: string) =>
  raise(HttpStatus.BAD_REQUEST, code, message);

export const unauthorized = (code: ErrorCode, message: string) =>
  raise(HttpStatus.UNAUTHORIZED, code, message);

export const forbidden = (code: ErrorCode, message: string) =>
  raise(HttpStatus.FORBIDDEN, code, message);

export const notFound = (code: ErrorCode, message: string) =>
  raise(HttpStatus.NOT_FOUND, code, message);

export const conflict = (code: ErrorCode, message: string) =>
  raise(HttpStatus.CONFLICT, code, message);

export const tooManyRequests = (code: ErrorCode, message: string) =>
  raise(HttpStatus.TOO_MANY_REQUESTS, code, message);

export const unavailable = (code: ErrorCode, message: string) =>
  raise(HttpStatus.SERVICE_UNAVAILABLE, code, message);

export const badGateway = (code: ErrorCode, message: string) =>
  raise(HttpStatus.BAD_GATEWAY, code, message);
