import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectArea } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export const PROJECT_CODE_PATTERN = /^[A-Z0-9]{2,5}$/;

export class ProjectDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ example: 'WORK' })
  code!: string;

  @ApiProperty({ enum: ProjectArea })
  area!: ProjectArea;

  @ApiProperty({ nullable: true, type: String })
  description!: string | null;

  @ApiProperty()
  position!: number;

  @ApiProperty()
  archived!: boolean;

  @ApiProperty()
  openTasks!: number;

  @ApiProperty()
  doneTasks!: number;

  @ApiProperty()
  createdAt!: string;
}

export class CreateProjectDto {
  @ApiProperty({ example: 'Website redesign' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @ApiProperty({ example: 'WEB', description: 'Two to five uppercase letters or digits' })
  @Matches(PROJECT_CODE_PATTERN)
  code!: string;

  @ApiProperty({ enum: ProjectArea })
  @IsEnum(ProjectArea)
  area!: ProjectArea;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateProjectDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(PROJECT_CODE_PATTERN)
  code?: string;

  @ApiPropertyOptional({ enum: ProjectArea })
  @IsOptional()
  @IsEnum(ProjectArea)
  area?: ProjectArea;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}

export class ReorderProjectsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  projectIds!: string[];
}
