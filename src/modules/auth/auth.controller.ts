import { Body, Controller, HttpCode, HttpStatus, Inject, Post, Req, Res } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';

import { Public } from '../../common/decorators/public.decorator';
import { appConfig, type AppConfig } from '../../config/app.config';
import { AuthService, type AuthResult } from './auth.service';
import {
  GoogleSignInDto,
  LoginDto,
  RegisterDto,
  ResendCodeDto,
  SessionDto,
  SessionTokenDto,
  VerificationPendingDto,
  VerifyEmailDto,
} from './dto/auth.dto';
import { TokenService } from './token.service';

export const REFRESH_COOKIE_NAME = 'pp_refresh';

const CREDENTIAL_RATE_LIMIT = Number(process.env.AUTH_RATE_LIMIT ?? 10);
const CREDENTIAL_THROTTLE = { default: { limit: CREDENTIAL_RATE_LIMIT, ttl: 60_000 } };
const REFRESH_THROTTLE = { default: { limit: 60, ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
    @Inject(appConfig.KEY) private readonly config: AppConfig,
  ) {}

  @Public()
  @Throttle(CREDENTIAL_THROTTLE)
  @Post('register')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Create an account and email a verification code' })
  @ApiOkResponse({ type: VerificationPendingDto })
  register(@Body() dto: RegisterDto): Promise<VerificationPendingDto> {
    return this.authService.register(dto);
  }

  @Public()
  @Throttle(CREDENTIAL_THROTTLE)
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm the email with the code and start a session' })
  @ApiOkResponse({ type: SessionDto })
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionDto> {
    return this.respondWithSession(await this.authService.verifyEmail(dto), response);
  }

  @Public()
  @Throttle(CREDENTIAL_THROTTLE)
  @Post('resend-code')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Send a fresh verification code' })
  @ApiOkResponse({ type: VerificationPendingDto })
  resendCode(@Body() dto: ResendCodeDto): Promise<VerificationPendingDto> {
    return this.authService.resendCode(dto.email);
  }

  @Public()
  @Throttle(CREDENTIAL_THROTTLE)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in with email and password' })
  @ApiOkResponse({ type: SessionDto })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionDto> {
    return this.respondWithSession(await this.authService.login(dto), response);
  }

  @Public()
  @Throttle(CREDENTIAL_THROTTLE)
  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in with a Google ID token' })
  @ApiOkResponse({ type: SessionDto })
  async google(
    @Body() dto: GoogleSignInDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionDto> {
    return this.respondWithSession(await this.authService.signInWithGoogle(dto), response);
  }

  @Public()
  @Throttle(REFRESH_THROTTLE)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange the refresh cookie for a new access token' })
  @ApiOkResponse({ type: SessionDto })
  async refresh(
    @Body() dto: SessionTokenDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionDto> {
    const result = await this.authService.refresh(this.readRefreshToken(request, dto));
    return this.respondWithSession(result, response);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'End the current session' })
  async logout(
    @Body() dto: SessionTokenDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logout(this.readRefreshToken(request, dto));
    response.clearCookie(REFRESH_COOKIE_NAME, this.cookieOptions());
  }

  private readRefreshToken(request: Request, dto: SessionTokenDto): string | undefined {
    const cookies = request.cookies as Record<string, string | undefined> | undefined;
    return cookies?.[REFRESH_COOKIE_NAME] ?? dto.refreshToken;
  }

  private respondWithSession(result: AuthResult, response: Response): SessionDto {
    response.cookie(REFRESH_COOKIE_NAME, result.refreshToken, {
      ...this.cookieOptions(),
      maxAge: this.tokenService.refreshTokenTtlMs,
    });

    return result.session;
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: this.config.isProduction ? 'none' : 'lax',
      secure: this.config.isProduction,
      domain: this.config.cookieDomain,
      path: '/api/auth',
    };
  }
}
