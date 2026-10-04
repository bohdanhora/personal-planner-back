import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class SaveAiProviderDto {
  @ApiProperty({
    example: 'https://api.anthropic.com/v1',
    description: 'Base URL of an OpenAI compatible chat completions API',
  })
  @IsUrl({ require_tld: false, require_protocol: true })
  @MaxLength(300)
  baseUrl!: string;

  @ApiProperty({ example: 'claude-sonnet-5-5' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  modelName!: string;

  @ApiPropertyOptional({
    example: 'sk-ant-...',
    description:
      'Stored encrypted and never returned. Omit it to keep the key already saved, which is what changing the model alone does.',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(400)
  apiKey?: string;
}

export class PreviewModelsDto {
  @ApiProperty({ example: 'https://api.openai.com/v1' })
  @IsUrl({ require_tld: false, require_protocol: true })
  @MaxLength(300)
  baseUrl!: string;

  @ApiPropertyOptional({
    example: 'sk-...',
    description: 'Used only for this request. Omit it to use the key saved for the same base URL.',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(400)
  apiKey?: string;
}

export class AiProviderDto {
  @ApiProperty()
  isConfigured!: boolean;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'https://api.anthropic.com/v1' })
  baseUrl!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'claude-sonnet-5-5' })
  modelName!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'sk-...4f2a',
    description: 'Masked key, the full value never leaves the server',
  })
  apiKeyHint!: string | null;
}

export class CatalogProviderDto {
  @ApiProperty({ example: 'anthropic' })
  id!: string;

  @ApiProperty({ example: 'Anthropic' })
  label!: string;

  @ApiProperty({ example: 'https://api.anthropic.com/v1' })
  baseUrl!: string;

  @ApiProperty({ example: 'https://console.anthropic.com/settings/keys' })
  apiKeysUrl!: string;

  @ApiProperty({ example: 'sk-ant-...' })
  keyHint!: string;

  @ApiProperty({ example: 'claude-sonnet-5-5' })
  defaultModel!: string;

  @ApiProperty({
    type: [String],
    example: ['claude-opus-5-5', 'claude-sonnet-5-5'],
    description: 'Well known models, offered before the key is connected',
  })
  models!: string[];
}

export class ProviderModelsDto {
  @ApiProperty({ type: [String], example: ['claude-opus-5-5', 'claude-sonnet-5-5'] })
  models!: string[];

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '2026-10-04T12:00:00.000Z',
    description: 'When the list was last read from the provider',
  })
  fetchedAt!: string | null;
}

export class AiProviderCheckDto {
  @ApiProperty()
  ok!: boolean;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'PROVIDER_KEY_REJECTED' })
  code!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  message!: string | null;
}
