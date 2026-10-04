import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskPriority, TaskStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import { IsLocalDate } from '../../../common/validation/is-local-date.validator';

const MINUTES_PER_DAY = 1440;
const MAX_DURATION_MINUTES = 720;

export const TASK_SCOPES = ['inbox', 'overdue'] as const;
export type TaskScope = (typeof TASK_SCOPES)[number];

export class TaskDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ nullable: true, type: String })
  notes!: string | null;

  @ApiProperty({ nullable: true, type: String, example: '2026-10-04' })
  date!: string | null;

  @ApiProperty({ nullable: true, type: Number, description: 'Minutes after midnight' })
  startMinutes!: number | null;

  @ApiProperty({ nullable: true, type: Number })
  durationMinutes!: number | null;

  @ApiProperty({ enum: TaskPriority })
  priority!: TaskPriority;

  @ApiProperty({ enum: TaskStatus })
  status!: TaskStatus;

  @ApiProperty()
  position!: number;

  @ApiProperty({ nullable: true, type: String })
  completedAt!: string | null;

  @ApiProperty({ nullable: true, type: String })
  projectId!: string | null;

  @ApiProperty()
  createdAt!: string;
}

export class CreateTaskDto {
  @ApiProperty({ example: 'Prepare the quarterly report' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ nullable: true, type: String, description: 'Empty for the inbox' })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsLocalDate()
  date?: string | null;

  @ApiPropertyOptional({ nullable: true, type: Number })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  @Max(MINUTES_PER_DAY - 1)
  startMinutes?: number | null;

  @ApiPropertyOptional({ nullable: true, type: Number })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(5)
  @Max(MAX_DURATION_MINUTES)
  durationMinutes?: number | null;

  @ApiPropertyOptional({ enum: TaskPriority })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  projectId?: string | null;
}

export class UpdateTaskDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsLocalDate()
  date?: string | null;

  @ApiPropertyOptional({ nullable: true, type: Number })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  @Max(MINUTES_PER_DAY - 1)
  startMinutes?: number | null;

  @ApiPropertyOptional({ nullable: true, type: Number })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(5)
  @Max(MAX_DURATION_MINUTES)
  durationMinutes?: number | null;

  @ApiPropertyOptional({ enum: TaskPriority })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional({ enum: TaskStatus })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  projectId?: string | null;
}

export class ListTasksQueryDto {
  @ApiPropertyOptional({ example: '2026-10-01' })
  @IsOptional()
  @IsLocalDate()
  from?: string;

  @ApiPropertyOptional({ example: '2026-10-07' })
  @IsOptional()
  @IsLocalDate()
  to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({ enum: TASK_SCOPES })
  @IsOptional()
  @IsIn(TASK_SCOPES)
  scope?: TaskScope;
}

export class OrderTasksDto {
  @ApiProperty({ nullable: true, type: String, description: 'Target day, empty for the inbox' })
  @ValidateIf((_, value) => value !== null)
  @IsLocalDate()
  date!: string | null;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(300)
  @IsUUID('4', { each: true })
  taskIds!: string[];
}

export class ScheduleItemDto {
  @ApiProperty()
  @IsUUID()
  taskId!: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(MINUTES_PER_DAY - 1)
  startMinutes!: number;

  @ApiProperty()
  @IsInt()
  @Min(5)
  @Max(MAX_DURATION_MINUTES)
  durationMinutes!: number;
}

export class ScheduleDayDto {
  @ApiProperty({ example: '2026-10-04' })
  @IsLocalDate()
  date!: string;

  @ApiProperty({ type: [ScheduleItemDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ScheduleItemDto)
  items!: ScheduleItemDto[];
}

export class CreateTasksDto {
  @ApiProperty({ type: [CreateTaskDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => CreateTaskDto)
  tasks!: CreateTaskDto[];
}

export class CarryOverDto {
  @ApiProperty({ example: '2026-10-04', description: 'Open tasks from earlier days move here' })
  @IsLocalDate()
  to!: string;
}

export class CarryOverResultDto {
  @ApiProperty()
  moved!: number;
}
