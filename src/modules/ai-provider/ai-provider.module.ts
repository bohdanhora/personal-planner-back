import { Module } from '@nestjs/common';

import { AiProviderController } from './ai-provider.controller';
import { AiProviderService } from './ai-provider.service';
import { ProviderChatService } from './provider-chat.service';

@Module({
  controllers: [AiProviderController],
  providers: [AiProviderService, ProviderChatService],
  exports: [AiProviderService, ProviderChatService],
})
export class AiProviderModule {}
