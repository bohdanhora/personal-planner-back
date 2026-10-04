import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { z } from 'zod';

import {
  ErrorCode,
  badGateway,
  tooManyRequests,
  unavailable,
} from '../../common/errors/error-code';
import { assistantConfig, type AssistantConfig } from '../../config/app.config';

export type AssistantEffort = 'low' | 'medium';

export interface AssistantRequest<Schema extends z.ZodType> {
  schema: Schema;
  system: string;
  messages: BetaMessageParam[];
  effort: AssistantEffort;
}

const MAX_OUTPUT_TOKENS = 16000;
const REQUEST_TIMEOUT_MS = 90_000;

@Injectable()
export class AssistantClientService {
  private readonly logger = new Logger(AssistantClientService.name);
  private readonly client: Anthropic | null;

  constructor(@Inject(assistantConfig.KEY) private readonly config: AssistantConfig) {
    this.client = config.isEnabled
      ? new Anthropic({ apiKey: config.apiKey, timeout: REQUEST_TIMEOUT_MS })
      : null;
  }

  get isEnabled(): boolean {
    return this.client !== null;
  }

  async generate<Schema extends z.ZodType>(
    request: AssistantRequest<Schema>,
  ): Promise<z.infer<Schema>> {
    if (!this.client) {
      throw unavailable(ErrorCode.AssistantDisabled, 'The assistant is not configured');
    }

    try {
      const response = await this.client.beta.messages.parse({
        model: this.config.model,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: request.system,
        messages: request.messages,
        output_config: { effort: request.effort, format: betaZodOutputFormat(request.schema) },
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
      });

      if (response.stop_reason === 'refusal' || !response.parsed_output) {
        this.logger.warn(
          `Assistant returned no usable output, stop reason ${response.stop_reason}`,
        );
        throw badGateway(ErrorCode.AssistantFailed, 'The assistant could not answer');
      }

      return response.parsed_output;
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError) {
        throw tooManyRequests(ErrorCode.AssistantBusy, 'The assistant is busy, try again shortly');
      }

      if (error instanceof Anthropic.APIError) {
        this.logger.error(`Assistant request failed with status ${error.status}: ${error.message}`);
        throw badGateway(ErrorCode.AssistantFailed, 'The assistant could not answer');
      }

      throw error;
    }
  }
}
