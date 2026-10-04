import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';

import { ErrorCode, badGateway } from '../../common/errors/error-code';
import { AiProviderService } from '../ai-provider/ai-provider.service';
import { ProviderChatService, type ProviderMessage } from '../ai-provider/provider-chat.service';
import { readJsonObject } from './assistant-json';

export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AssistantRequest<Schema extends z.ZodType> {
  schema: Schema;
  system: string;
  messages: AssistantMessage[];
}

type ReadResult<Schema extends z.ZodType> =
  { success: true; data: z.output<Schema> } | { success: false; error: string };

const ERROR_LENGTH = 600;

const answerFormat = (schema: z.ZodType): string =>
  [
    'Answer with one JSON object and nothing else: no markdown, no code fences, no text around it.',
    'It must match this JSON Schema:',
    JSON.stringify(z.toJSONSchema(schema, { io: 'input' })),
  ].join('\n');

@Injectable()
export class AssistantClientService {
  private readonly logger = new Logger(AssistantClientService.name);

  constructor(
    private readonly providers: AiProviderService,
    private readonly chat: ProviderChatService,
  ) {}

  async generate<Schema extends z.ZodType>(
    userId: string,
    request: AssistantRequest<Schema>,
  ): Promise<z.output<Schema>> {
    const credentials = await this.providers.getCredentials(userId);
    const messages: ProviderMessage[] = [
      { role: 'system', content: `${request.system}\n\n${answerFormat(request.schema)}` },
      ...request.messages,
    ];

    const first = await this.chat.complete(credentials, messages);
    const parsed = this.read(request.schema, first);

    if (parsed.success) {
      return parsed.data;
    }

    this.logger.warn(`${credentials.modelName}: the answer did not match the schema, asking again`);

    const second = await this.chat.complete(credentials, [
      ...messages,
      { role: 'assistant', content: first },
      {
        role: 'user',
        content: `That answer does not match the schema: ${parsed.error}. Send the corrected JSON object only.`,
      },
    ]);
    const repaired = this.read(request.schema, second);

    if (repaired.success) {
      return repaired.data;
    }

    throw badGateway(ErrorCode.AssistantFailed, 'The model answered in a shape the app cannot use');
  }

  private read<Schema extends z.ZodType>(schema: Schema, content: string): ReadResult<Schema> {
    const json = readJsonObject(content);

    if (json === undefined) {
      return { success: false, error: 'it is not a JSON object' };
    }

    const result = schema.safeParse(json);

    return result.success
      ? { success: true, data: result.data }
      : { success: false, error: z.prettifyError(result.error).slice(0, ERROR_LENGTH) };
  }
}
