import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Locale } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { IsTimeZone } from '../../../common/validation/is-time-zone.validator';
import { UserDto } from '../../users/dto/user.dto';

export class ClientContextDto {
  @ApiPropertyOptional({ example: 'Europe/Kyiv', default: 'UTC' })
  @IsOptional()
  @IsTimeZone()
  timezone?: string;

  @ApiPropertyOptional({ enum: Locale, default: Locale.en })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale;
}

export class RegisterDto extends ClientContextDto {
  @ApiProperty({ example: 'me@example.com' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ minLength: 8, example: 'correct horse battery' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiProperty({ example: 'Bohdan' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  displayName!: string;
}

export class LoginDto {
  @ApiProperty({ example: 'me@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}

export class VerifyEmailDto {
  @ApiProperty({ example: 'me@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '482913' })
  @Matches(/^\d{6}$/)
  code!: string;
}

export class ResendCodeDto {
  @ApiProperty({ example: 'me@example.com' })
  @IsEmail()
  email!: string;
}

export class GoogleSignInDto extends ClientContextDto {
  @ApiProperty({ description: 'The ID token issued by Google Identity Services' })
  @IsString()
  @MinLength(1)
  idToken!: string;
}

export class SessionTokenDto {
  @ApiPropertyOptional({ description: 'The refresh token, when the cookie could not be stored' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  refreshToken?: string;
}

export class VerificationPendingDto {
  @ApiProperty()
  email!: string;

  @ApiProperty({ description: 'Seconds until another code can be requested' })
  resendAfterSeconds!: number;
}

export class SessionDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty({ description: 'Access token lifetime in seconds' })
  expiresIn!: number;

  @ApiProperty({ type: UserDto })
  user!: UserDto;
}
