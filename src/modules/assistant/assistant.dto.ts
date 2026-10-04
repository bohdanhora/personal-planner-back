import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskPriority } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import { IsLocalDate } from '../../common/validation/is-local-date.validator';

export class DayContextDto {
  @ApiPropertyOptional({ example: '2026-10-04', description: 'The day in focus, today by default' })
  @IsOptional()
  @IsLocalDate()
  date?: string;
}

export class ParseRequestDto extends DayContextDto {
  @ApiProperty({ example: 'tomorrow 10:00 call with Anna about the budget, 30 min' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  text!: string;
}

export class SuggestRequestDto extends DayContextDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class ChatMessageDto {
  @ApiProperty({ enum: ['user', 'assistant'] })
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content!: string;
}

export class ChatRequestDto extends DayContextDto {
  @ApiProperty({ type: [ChatMessageDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(24)
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages!: ChatMessageDto[];
}

export class TaskDraftDto {
  @ApiProperty()
  title!: string;

  @ApiProperty({ nullable: true, type: String })
  notes!: string | null;

  @ApiProperty({ nullable: true, type: String })
  date!: string | null;

  @ApiProperty({ nullable: true, type: Number })
  startMinutes!: number | null;

  @ApiProperty({ nullable: true, type: Number })
  durationMinutes!: number | null;

  @ApiProperty({ enum: TaskPriority })
  priority!: TaskPriority;

  @ApiProperty({ nullable: true, type: String })
  projectId!: string | null;
}

export class DraftsDto {
  @ApiProperty({ type: [TaskDraftDto] })
  drafts!: TaskDraftDto[];
}

export class SuggestionDto {
  @ApiProperty({ type: TaskDraftDto })
  draft!: TaskDraftDto;
}

export class PlanItemDto {
  @ApiProperty()
  taskId!: string;

  @ApiProperty()
  startMinutes!: number;

  @ApiProperty()
  durationMinutes!: number;

  @ApiProperty({ nullable: true, type: String })
  note!: string | null;
}

export class UnscheduledDto {
  @ApiProperty()
  taskId!: string;

  @ApiProperty()
  reason!: string;
}

export class PlanDto {
  @ApiProperty()
  date!: string;

  @ApiProperty()
  summary!: string;

  @ApiProperty({ type: [PlanItemDto] })
  items!: PlanItemDto[];

  @ApiProperty({ type: [UnscheduledDto] })
  unscheduled!: UnscheduledDto[];
}

export class TipDto {
  @ApiProperty()
  title!: string;

  @ApiProperty()
  body!: string;
}

export class TipsDto {
  @ApiProperty({ type: [TipDto] })
  tips!: TipDto[];
}

export class ChatReplyDto {
  @ApiProperty()
  reply!: string;

  @ApiProperty({ type: [TaskDraftDto] })
  drafts!: TaskDraftDto[];
}

export class MetaDto {
  @ApiProperty({ nullable: true, type: String })
  googleClientId!: string | null;

  @ApiProperty()
  assistantEnabled!: boolean;
}
