import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';

export const INSIGHT_RANGES = [7, 30, 90] as const;

export class InsightsQueryDto {
  @ApiPropertyOptional({ enum: INSIGHT_RANGES, default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsIn(INSIGHT_RANGES)
  days?: (typeof INSIGHT_RANGES)[number];
}

export class DailyPointDto {
  @ApiProperty()
  date!: string;

  @ApiProperty()
  planned!: number;

  @ApiProperty()
  completed!: number;

  @ApiProperty()
  focusMinutes!: number;
}

export class ProjectPointDto {
  @ApiProperty({ nullable: true, type: String })
  projectId!: string | null;

  @ApiProperty()
  completed!: number;

  @ApiProperty()
  open!: number;
}

export class InsightsDto {
  @ApiProperty()
  from!: string;

  @ApiProperty()
  to!: string;

  @ApiProperty({ type: [DailyPointDto] })
  daily!: DailyPointDto[];

  @ApiProperty({ type: [ProjectPointDto] })
  byProject!: ProjectPointDto[];

  @ApiProperty({ type: [Number], description: 'Average completions per weekday, Monday first' })
  byWeekday!: number[];

  @ApiProperty()
  completed!: number;

  @ApiProperty()
  planned!: number;

  @ApiProperty({ description: 'Share of tasks planned in the range that are done, in percent' })
  completionRate!: number;

  @ApiProperty()
  focusMinutes!: number;

  @ApiProperty()
  currentStreak!: number;

  @ApiProperty()
  bestStreak!: number;

  @ApiProperty()
  overdue!: number;

  @ApiProperty()
  inbox!: number;
}
