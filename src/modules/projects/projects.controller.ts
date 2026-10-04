import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseBoolPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import {
  CreateProjectDto,
  ProjectDto,
  ReorderProjectsDto,
  UpdateProjectDto,
} from './dto/project.dto';
import { ProjectsService } from './projects.service';

@ApiTags('projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: 'Projects with their task counts' })
  @ApiQuery({ name: 'includeArchived', required: false, type: Boolean })
  @ApiOkResponse({ type: [ProjectDto] })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('includeArchived', new ParseBoolPipe({ optional: true })) includeArchived?: boolean,
  ): Promise<ProjectDto[]> {
    return this.projectsService.list(user.id, includeArchived ?? false);
  }

  @Post()
  @ApiOperation({ summary: 'Create a project' })
  @ApiOkResponse({ type: ProjectDto })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProjectDto,
  ): Promise<ProjectDto> {
    return this.projectsService.create(user.id, dto);
  }

  @Put('order')
  @ApiOperation({ summary: 'Store the order of projects' })
  @ApiOkResponse({ type: [ProjectDto] })
  reorder(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReorderProjectsDto,
  ): Promise<ProjectDto[]> {
    return this.projectsService.reorder(user.id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'One project' })
  @ApiOkResponse({ type: ProjectDto })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProjectDto> {
    return this.projectsService.get(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename, recode, move between areas or archive a project' })
  @ApiOkResponse({ type: ProjectDto })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<ProjectDto> {
    return this.projectsService.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a project, its tasks stay without a project' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.projectsService.remove(user.id, id);
  }
}
