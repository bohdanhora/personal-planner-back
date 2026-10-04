import { Injectable } from '@nestjs/common';
import { Locale, type User } from '@prisma/client';
import { compare, hash } from 'bcrypt';

import {
  ErrorCode,
  badRequest,
  conflict,
  forbidden,
  unauthorized,
} from '../../common/errors/error-code';
import { PrismaService } from '../../prisma/prisma.service';
import { StarterProjectsService } from '../projects/starter-projects.service';
import { toUserDto } from '../users/dto/user.dto';
import type {
  GoogleSignInDto,
  LoginDto,
  RegisterDto,
  SessionDto,
  VerificationPendingDto,
  VerifyEmailDto,
} from './dto/auth.dto';
import { EmailVerificationService, RESEND_COOLDOWN_MS } from './email-verification.service';
import { GoogleIdentityService, type GoogleIdentity } from './google-identity.service';
import { TokenService } from './token.service';

const PASSWORD_SALT_ROUNDS = 12;
const DEFAULT_TIMEZONE = 'UTC';

export interface AuthResult {
  session: SessionDto;
  refreshToken: string;
}

const normaliseEmail = (email: string): string => email.trim().toLowerCase();

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly googleIdentity: GoogleIdentityService,
    private readonly verification: EmailVerificationService,
    private readonly starterProjects: StarterProjectsService,
  ) {}

  async register(dto: RegisterDto): Promise<VerificationPendingDto> {
    const email = normaliseEmail(dto.email);
    const existing = await this.prisma.user.findUnique({ where: { email } });

    if (existing?.emailVerifiedAt || existing?.googleId) {
      throw conflict(ErrorCode.EmailTaken, 'An account with this email already exists');
    }

    const profile = {
      passwordHash: await hash(dto.password, PASSWORD_SALT_ROUNDS),
      displayName: dto.displayName.trim(),
      locale: dto.locale ?? Locale.en,
      timezone: dto.timezone ?? DEFAULT_TIMEZONE,
    };

    const user = existing
      ? await this.prisma.user.update({ where: { id: existing.id }, data: profile })
      : await this.prisma.user.create({ data: { email, ...profile } });

    return { email, resendAfterSeconds: await this.verification.issue(user) };
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { email: normaliseEmail(dto.email) } });

    if (!user || user.emailVerifiedAt) {
      throw badRequest(ErrorCode.InvalidCode, 'The code is not valid');
    }

    await this.verification.consume(user.id, dto.code);
    await this.starterProjects.ensure(user.id, user.locale);

    return this.startSession(await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } }));
  }

  async resendCode(rawEmail: string): Promise<VerificationPendingDto> {
    const email = normaliseEmail(rawEmail);
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || user.emailVerifiedAt) {
      return { email, resendAfterSeconds: Math.ceil(RESEND_COOLDOWN_MS / 1000) };
    }

    return { email, resendAfterSeconds: await this.verification.resend(user) };
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { email: normaliseEmail(dto.email) } });
    const passwordMatches = user?.passwordHash
      ? await compare(dto.password, user.passwordHash)
      : false;

    if (!user || !passwordMatches) {
      throw unauthorized(ErrorCode.InvalidCredentials, 'Incorrect email or password');
    }

    if (!user.emailVerifiedAt) {
      await this.verification.issue(user);
      throw forbidden(ErrorCode.EmailNotVerified, 'Confirm your email to sign in');
    }

    return this.startSession(user);
  }

  async signInWithGoogle(dto: GoogleSignInDto): Promise<AuthResult> {
    const identity = await this.googleIdentity.verify(dto.idToken);
    const user = await this.resolveGoogleUser(identity, dto);

    await this.starterProjects.ensure(user.id, user.locale);

    return this.startSession(user);
  }

  async refresh(refreshToken: string | undefined): Promise<AuthResult> {
    const active = refreshToken ? await this.tokenService.findActiveToken(refreshToken) : null;

    if (!refreshToken || !active) {
      throw unauthorized(ErrorCode.SessionExpired, 'Session expired, sign in again');
    }

    await this.tokenService.rotateRefreshToken(refreshToken);

    const user = await this.prisma.user.findUnique({ where: { id: active.userId } });

    if (!user) {
      throw unauthorized(ErrorCode.SessionExpired, 'Session expired, sign in again');
    }

    return this.startSession(user);
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (refreshToken) {
      await this.tokenService.revokeRefreshToken(refreshToken);
    }
  }

  private async resolveGoogleUser(identity: GoogleIdentity, dto: GoogleSignInDto): Promise<User> {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ googleId: identity.googleId }, { email: identity.email }] },
    });

    if (!existing) {
      return this.prisma.user.create({
        data: {
          email: identity.email,
          googleId: identity.googleId,
          emailVerifiedAt: new Date(),
          displayName: identity.displayName,
          locale: dto.locale ?? Locale.en,
          timezone: dto.timezone ?? DEFAULT_TIMEZONE,
        },
      });
    }

    const verifiedBefore = existing.emailVerifiedAt !== null;

    return this.prisma.user.update({
      where: { id: existing.id },
      data: {
        googleId: identity.googleId,
        emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
        passwordHash: verifiedBefore ? existing.passwordHash : null,
        displayName: existing.displayName ?? identity.displayName,
      },
    });
  }

  private async startSession(user: User): Promise<AuthResult> {
    const accessToken = this.tokenService.signAccessToken({ sub: user.id, email: user.email });
    const refresh = await this.tokenService.issueRefreshToken(user.id);

    return {
      refreshToken: refresh.token,
      session: {
        accessToken,
        expiresIn: this.tokenService.accessTokenTtlSeconds,
        user: toUserDto(user),
      },
    };
  }
}
