import { Inject, Injectable } from '@nestjs/common';

import { decryptSecret, encryptSecret, maskSecret } from '../../common/crypto/secret-cipher';
import { ErrorCode, badGateway, badRequest, unavailable } from '../../common/errors/error-code';
import { securityConfig, type SecurityConfig } from '../../config/app.config';
import { PrismaService } from '../../prisma/prisma.service';
import type { AiProviderDto, ProviderModelsDto, SaveAiProviderDto } from './dto/ai-provider.dto';
import { findProvider, providerHeaders, usableModels } from './provider-catalog';

export interface ProviderCredentials {
  baseUrl: string;
  modelName: string;
  apiKey: string;
}

interface ModelListResponse {
  data?: { id?: string }[];
}

const MODELS_TIMEOUT_MS = 10_000;
const UNAUTHORISED = 401;

const NOT_CONFIGURED: AiProviderDto = {
  isConfigured: false,
  baseUrl: null,
  modelName: null,
  apiKeyHint: null,
};

@Injectable()
export class AiProviderService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(securityConfig.KEY) private readonly config: SecurityConfig,
  ) {}

  async get(userId: string): Promise<AiProviderDto> {
    const provider = await this.prisma.aiProvider.findUnique({ where: { userId } });

    if (!provider) {
      return { ...NOT_CONFIGURED };
    }

    return {
      isConfigured: true,
      baseUrl: provider.baseUrl,
      modelName: provider.modelName,
      apiKeyHint: provider.apiKeyHint,
    };
  }

  async save(userId: string, dto: SaveAiProviderDto): Promise<AiProviderDto> {
    const apiKey = dto.apiKey?.trim();
    const existing = await this.prisma.aiProvider.findUnique({ where: { userId } });
    const baseUrl = dto.baseUrl.trim().replace(/\/+$/, '');

    if (!apiKey && (!existing || existing.baseUrl !== baseUrl)) {
      throw badRequest(ErrorCode.ProviderKeyRequired, 'An API key is needed for this provider');
    }

    const settings = { baseUrl, modelName: dto.modelName.trim() };

    const secret = apiKey
      ? (() => {
          const encrypted = encryptSecret(apiKey, this.config.encryptionKey);

          return {
            apiKeyCipher: encrypted.cipher,
            apiKeyIv: encrypted.iv,
            apiKeyTag: encrypted.tag,
            apiKeyHint: maskSecret(apiKey),
          };
        })()
      : null;

    if (existing) {
      const staleModels = secret !== null ? { models: [], modelsFetchedAt: null } : {};

      await this.prisma.aiProvider.update({
        where: { userId },
        data: { ...settings, ...(secret ?? {}), ...staleModels },
      });
    } else if (secret) {
      await this.prisma.aiProvider.create({ data: { userId, ...settings, ...secret } });
    }

    return this.get(userId);
  }

  async remove(userId: string): Promise<void> {
    await this.prisma.aiProvider.deleteMany({ where: { userId } });
  }

  async getCredentials(userId: string): Promise<ProviderCredentials> {
    const provider = await this.prisma.aiProvider.findUnique({ where: { userId } });

    if (!provider) {
      throw unavailable(
        ErrorCode.AssistantNotConfigured,
        'Connect an AI provider in settings to use the assistant',
      );
    }

    return {
      baseUrl: provider.baseUrl,
      modelName: provider.modelName,
      apiKey: decryptSecret(
        { cipher: provider.apiKeyCipher, iv: provider.apiKeyIv, tag: provider.apiKeyTag },
        this.config.encryptionKey,
      ),
    };
  }

  async listModels(userId: string): Promise<ProviderModelsDto> {
    const provider = await this.prisma.aiProvider.findUnique({
      where: { userId },
      select: { models: true, modelsFetchedAt: true },
    });

    if (!provider) {
      throw unavailable(ErrorCode.AssistantNotConfigured, 'No AI provider is connected');
    }

    if (!provider.modelsFetchedAt) {
      return this.refreshModels(userId);
    }

    return { models: provider.models, fetchedAt: provider.modelsFetchedAt.toISOString() };
  }

  async refreshModels(userId: string): Promise<ProviderModelsDto> {
    const credentials = await this.getCredentials(userId);
    const models = await this.fetchModels(credentials);
    const fetchedAt = new Date();

    await this.prisma.aiProvider.update({
      where: { userId },
      data: { models, modelsFetchedAt: fetchedAt },
    });

    return { models, fetchedAt: fetchedAt.toISOString() };
  }

  private async fetchModels(credentials: ProviderCredentials): Promise<string[]> {
    let response: Response;

    try {
      response = await fetch(`${credentials.baseUrl}/models`, {
        headers: providerHeaders(credentials.baseUrl, credentials.apiKey),
        signal: AbortSignal.timeout(MODELS_TIMEOUT_MS),
      });
    } catch {
      throw badGateway(ErrorCode.ProviderUnreachable, 'The provider could not be reached');
    }

    if (response.status === UNAUTHORISED) {
      throw badGateway(ErrorCode.ProviderKeyRejected, 'The provider rejected the API key');
    }

    if (!response.ok) {
      throw badGateway(
        ErrorCode.ProviderFailed,
        `The provider could not list its models (${response.status})`,
      );
    }

    const payload = (await response.json()) as ModelListResponse;

    return usableModels(
      (payload.data ?? [])
        .map((model) => model.id)
        .filter((id): id is string => typeof id === 'string'),
      findProvider(credentials.baseUrl)?.models ?? [],
    );
  }
}
