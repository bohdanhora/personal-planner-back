import { Injectable, Logger } from '@nestjs/common';
import { setTimeout as sleep } from 'node:timers/promises';

import { ErrorCode, badGateway, tooManyRequests } from '../../common/errors/error-code';
import type { ProviderCredentials } from './ai-provider.service';
import { providerHeaders } from './provider-catalog';
import {
  describeFailure,
  isRetryable,
  refusedParameter,
  requiresMaxTokens,
  retryAfterSeconds,
  type RefusedParameter,
} from './provider-failure';

export interface ProviderMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionOptions {
  timeoutMs?: number;
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: string }; finish_reason?: string }[];
}

interface Attempt {
  messages: ProviderMessage[];
  dropped: RefusedParameter[];
  maxTokens: number | null;
  model: string;
  timeoutMs: number;
}

interface ProviderReply {
  status: number;
  ok: boolean;
  body: string;
  retryAfter: number | null;
  ms: number;
}

const DEFAULT_TIMEOUT_MS = 90_000;
const RETRY_DELAY_MS = 1_500;
const MS_PER_SECOND = 1_000;
const UNAUTHORISED = 401;
const BAD_REQUEST = 400;
const TOO_MANY_REQUESTS = 429;
const ERROR_SNIPPET_LENGTH = 500;
const PARAMETER_RETRIES = 3;
const FALLBACK_MAX_TOKENS = 8_000;
const RAN_OUT_OF_ROOM = 'length';

const snippet = (body: string): string =>
  body.trim().slice(0, ERROR_SNIPPET_LENGTH) || '(empty body)';

@Injectable()
export class ProviderChatService {
  private readonly logger = new Logger(ProviderChatService.name);

  async complete(
    credentials: ProviderCredentials,
    messages: ProviderMessage[],
    options: CompletionOptions = {},
  ): Promise<string> {
    let attempt: Attempt = {
      messages,
      dropped: [],
      maxTokens: null,
      model: credentials.modelName,
      timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    };

    let reply = await this.ask(credentials, attempt);

    for (let retry = 0; retry < PARAMETER_RETRIES && reply.status === BAD_REQUEST; retry += 1) {
      if (attempt.maxTokens === null && requiresMaxTokens(reply.body)) {
        attempt = { ...attempt, maxTokens: FALLBACK_MAX_TOKENS };
      } else {
        const refused = refusedParameter(reply.body);

        if (!refused || attempt.dropped.includes(refused)) {
          break;
        }

        this.logger.warn(`${attempt.model}: the provider refused ${refused}, asking without it`);
        attempt = { ...attempt, dropped: [...attempt.dropped, refused] };
      }

      reply = await this.ask(credentials, attempt);
    }

    if (reply.status === UNAUTHORISED) {
      throw badGateway(ErrorCode.ProviderKeyRejected, 'The provider rejected the API key');
    }

    if (reply.status === TOO_MANY_REQUESTS) {
      throw tooManyRequests(
        ErrorCode.AssistantBusy,
        describeFailure(reply.status, reply.body, reply.retryAfter),
      );
    }

    if (!reply.ok) {
      this.logger.warn(
        `${attempt.model}: the provider answered ${reply.status} after ${reply.ms} ms: ${snippet(reply.body)}`,
      );
      throw badGateway(
        ErrorCode.ProviderFailed,
        describeFailure(reply.status, reply.body, reply.retryAfter),
      );
    }

    return this.readContent(reply, attempt.model);
  }

  private async ask(credentials: ProviderCredentials, attempt: Attempt): Promise<ProviderReply> {
    const reply = await this.send(credentials, attempt);

    if (!isRetryable(reply.status)) {
      return reply;
    }

    const wait = reply.retryAfter ? reply.retryAfter * MS_PER_SECOND : RETRY_DELAY_MS;

    this.logger.warn(`${attempt.model}: the provider answered ${reply.status}, retrying`);
    await sleep(wait);

    return this.send(credentials, attempt);
  }

  private readContent(reply: ProviderReply, model: string): string {
    let payload: ChatCompletionResponse;

    try {
      payload = JSON.parse(reply.body) as ChatCompletionResponse;
    } catch {
      this.logger.warn(`${model}: the answer is not JSON: ${snippet(reply.body)}`);
      throw badGateway(ErrorCode.ProviderFailed, 'The provider returned an unreadable answer');
    }

    const choice = payload.choices?.[0];

    if (choice?.finish_reason === RAN_OUT_OF_ROOM) {
      throw badGateway(
        ErrorCode.ProviderFailed,
        'The provider ran out of room before it finished the answer',
      );
    }

    const content = choice?.message?.content;

    if (!content) {
      throw badGateway(ErrorCode.ProviderFailed, 'The provider returned an empty answer');
    }

    return content;
  }

  private async send(credentials: ProviderCredentials, attempt: Attempt): Promise<ProviderReply> {
    const body = JSON.stringify({
      model: attempt.model,
      messages: attempt.messages,
      ...(attempt.maxTokens === null ? {} : { max_tokens: attempt.maxTokens }),
      ...(attempt.dropped.includes('temperature') ? {} : { temperature: 0.3 }),
      ...(attempt.dropped.includes('response_format')
        ? {}
        : { response_format: { type: 'json_object' } }),
    });
    const started = Date.now();

    try {
      const response = await fetch(`${credentials.baseUrl}/chat/completions`, {
        method: 'POST',
        signal: AbortSignal.timeout(attempt.timeoutMs),
        headers: {
          'Content-Type': 'application/json',
          ...providerHeaders(credentials.baseUrl, credentials.apiKey),
        },
        body,
      });

      return {
        status: response.status,
        ok: response.ok,
        body: await response.text(),
        retryAfter: retryAfterSeconds(response.headers.get('retry-after')),
        ms: Date.now() - started,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw badGateway(
          ErrorCode.ProviderTimeout,
          `The provider did not answer within ${attempt.timeoutMs / MS_PER_SECOND} s`,
        );
      }

      this.logger.warn(
        `${attempt.model}: the request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw badGateway(ErrorCode.ProviderUnreachable, 'The provider could not be reached');
    }
  }
}
