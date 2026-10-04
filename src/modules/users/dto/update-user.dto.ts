import { ApiPropertyOptional } from '@nestjs/swagger';
import { Locale } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { IsTimeZone } from '../../../common/validation/is-time-zone.validator';

const MINUTES_PER_DAY = 1440;

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Bohdan' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string;

  @ApiPropertyOptional({ enum: Locale })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale;

  @ApiPropertyOptional({ example: 'Europe/Kyiv' })
  @IsOptional()
  @IsTimeZone()
  timezone?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: MINUTES_PER_DAY - 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MINUTES_PER_DAY - 1)
  dayStartMinutes?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: MINUTES_PER_DAY })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MINUTES_PER_DAY)
  dayEndMinutes?: number;

  @ApiPropertyOptional({
    description: 'Mark the first run guide as finished, or false to show it again',
  })
  @IsOptional()
  @IsBoolean()
  onboarded?: boolean;
}
