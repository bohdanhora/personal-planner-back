import { Module } from '@nestjs/common';

import { InsightsModule } from '../insights/insights.module';
import { AssistantClientService } from './assistant-client.service';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { MetaController } from './meta.controller';

@Module({
  imports: [InsightsModule],
  controllers: [AssistantController, MetaController],
  providers: [AssistantService, AssistantClientService],
})
export class AssistantModule {}
