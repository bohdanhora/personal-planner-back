import { Module } from '@nestjs/common';

import { AiProviderModule } from '../ai-provider/ai-provider.module';
import { InsightsModule } from '../insights/insights.module';
import { AssistantClientService } from './assistant-client.service';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';

@Module({
  imports: [AiProviderModule, InsightsModule],
  controllers: [AssistantController],
  providers: [AssistantService, AssistantClientService],
})
export class AssistantModule {}
