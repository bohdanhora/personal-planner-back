import { Module } from '@nestjs/common';

import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { StarterProjectsService } from './starter-projects.service';

@Module({
  controllers: [ProjectsController],
  providers: [ProjectsService, StarterProjectsService],
  exports: [ProjectsService, StarterProjectsService],
})
export class ProjectsModule {}
