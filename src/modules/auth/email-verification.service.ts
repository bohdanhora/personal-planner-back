import { createHash, randomInt, timingSafeEqual } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';

import { ErrorCode, badRequest, tooManyRequests } from '../../common/errors/error-code';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

export const CODE_TTL_MS = 15 * 60_000;
export const RESEND_COOLDOWN_MS = 60_000;
export const MAX_ATTEMPTS = 5;

@Injectable()
export class EmailVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async issue(user: Pick<User, 'id' | 'email' | 'locale'>): Promise<number> {
    const existing = await this.prisma.emailVerification.findUnique({
      where: { userId: user.id },
      select: { sentAt: true },
    });

    const waitMs = existing ? this.cooldownLeftMs(existing.sentAt) : 0;

    if (waitMs > 0) {
      return Math.ceil(waitMs / 1000);
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const record = {
      codeHash: this.hash(user.id, code),
      attempts: 0,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
      sentAt: new Date(),
    };

    await this.prisma.emailVerification.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...record },
      update: record,
    });

    await this.mail.sendVerificationCode(user.email, code, user.locale);

    return Math.ceil(RESEND_COOLDOWN_MS / 1000);
  }

  async resend(user: Pick<User, 'id' | 'email' | 'locale'>): Promise<number> {
    const existing = await this.prisma.emailVerification.findUnique({
      where: { userId: user.id },
      select: { sentAt: true },
    });

    const waitMs = existing ? this.cooldownLeftMs(existing.sentAt) : 0;

    if (waitMs > 0) {
      throw tooManyRequests(ErrorCode.ResendTooSoon, `Wait ${Math.ceil(waitMs / 1000)} seconds`);
    }

    return this.issue(user);
  }

  async consume(userId: string, code: string): Promise<void> {
    const record = await this.prisma.emailVerification.findUnique({ where: { userId } });

    if (!record) {
      throw badRequest(ErrorCode.InvalidCode, 'The code is not valid');
    }

    if (record.attempts >= MAX_ATTEMPTS) {
      throw tooManyRequests(ErrorCode.TooManyAttempts, 'Too many attempts, request a new code');
    }

    if (record.expiresAt.getTime() <= Date.now()) {
      throw badRequest(ErrorCode.CodeExpired, 'The code has expired, request a new one');
    }

    if (!this.matches(record.codeHash, this.hash(userId, code))) {
      await this.prisma.emailVerification.update({
        where: { userId },
        data: { attempts: { increment: 1 } },
      });
      throw badRequest(ErrorCode.InvalidCode, 'The code is not valid');
    }

    await this.prisma.$transaction([
      this.prisma.emailVerification.delete({ where: { userId } }),
      this.prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } }),
    ]);
  }

  private cooldownLeftMs(sentAt: Date): number {
    return Math.max(0, sentAt.getTime() + RESEND_COOLDOWN_MS - Date.now());
  }

  private hash(userId: string, code: string): string {
    return createHash('sha256').update(`${userId}:${code}`).digest('hex');
  }

  private matches(expected: string, actual: string): boolean {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(actual, 'hex'));
  }
}
