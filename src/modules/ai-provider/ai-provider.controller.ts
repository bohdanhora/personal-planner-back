import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { AiProviderService } from './ai-provider.service';
import {
  AiProviderCheckDto,
  AiProviderDto,
  CatalogProviderDto,
  ProviderModelsDto,
  SaveAiProviderDto,
} from './dto/ai-provider.dto';
import { PROVIDER_CATALOG } from './provider-catalog';
import { ProviderChatService } from './provider-chat.service';

const CHECK_THROTTLE = { default: { limit: 10, ttl: 60_000 } };
const MODELS_THROTTLE = { default: { limit: 20, ttl: 60_000 } };
const CHECK_TIMEOUT_MS = 30_000;

@ApiTags('ai-provider')
@ApiBearerAuth()
@Controller('ai-provider')
export class AiProviderController {
  constructor(
    private readonly providerService: AiProviderService,
    private readonly chat: ProviderChatService,
  ) {}

  @Get('catalog')
  @ApiOperation({ summary: 'Providers the app knows, with their base URL and known models' })
  @ApiOkResponse({ type: [CatalogProviderDto] })
  catalog(): CatalogProviderDto[] {
    return PROVIDER_CATALOG;
  }

  @Get()
  @ApiOperation({ summary: 'Current provider with a masked key' })
  @ApiOkResponse({ type: AiProviderDto })
  get(@CurrentUser() user: AuthenticatedUser): Promise<AiProviderDto> {
    return this.providerService.get(user.id);
  }

  @Put()
  @ApiOperation({ summary: 'Store the provider and model, the key is encrypted' })
  @ApiOkResponse({ type: AiProviderDto })
  save(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SaveAiProviderDto,
  ): Promise<AiProviderDto> {
    return this.providerService.save(user.id, dto);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Forget the provider and its key' })
  remove(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.providerService.remove(user.id);
  }

  @Get('models')
  @Throttle(MODELS_THROTTLE)
  @ApiOperation({
    summary: 'Models the stored key can reach',
    description: 'Served from the stored copy, the provider is asked only when there is none yet',
  })
  @ApiOkResponse({ type: ProviderModelsDto })
  models(@CurrentUser() user: AuthenticatedUser): Promise<ProviderModelsDto> {
    return this.providerService.listModels(user.id);
  }

  @Post('models/refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle(MODELS_THROTTLE)
  @ApiOperation({ summary: 'Ask the provider for its model list again' })
  @ApiOkResponse({ type: ProviderModelsDto })
  refreshModels(@CurrentUser() user: AuthenticatedUser): Promise<ProviderModelsDto> {
    return this.providerService.refreshModels(user.id);
  }

  @Post('check')
  @HttpCode(HttpStatus.OK)
  @Throttle(CHECK_THROTTLE)
  @ApiOperation({ summary: 'Send one small request to confirm the key and model work' })
  @ApiOkResponse({ type: AiProviderCheckDto })
  async check(@CurrentUser() user: AuthenticatedUser): Promise<AiProviderCheckDto> {
    const credentials = await this.providerService.getCredentials(user.id);

    try {
      await this.chat.complete(
        credentials,
        [
          { role: 'system', content: 'Answer with a JSON object only.' },
          { role: 'user', content: 'Reply with {"ok": true}' },
        ],
        { timeoutMs: CHECK_TIMEOUT_MS },
      );

      return { ok: true, code: null, message: null };
    } catch (error) {
      if (error instanceof HttpException) {
        const body = error.getResponse() as { code?: string; message?: string };
        return { ok: false, code: body.code ?? null, message: body.message ?? error.message };
      }

      throw error;
    }
  }
}
