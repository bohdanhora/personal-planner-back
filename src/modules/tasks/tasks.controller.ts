import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import {
  CarryOverDto,
  CarryOverResultDto,
  CreateTaskDto,
  CreateTasksDto,
  ListTasksQueryDto,
  OrderTasksDto,
  ScheduleDayDto,
  TaskDto,
  UpdateTaskDto,
} from './dto/task.dto';
import { TasksService } from './tasks.service';

@ApiTags('tasks')
@ApiBearerAuth()
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @ApiOperation({ summary: 'Tasks in a date range, a project, the inbox or overdue' })
  @ApiOkResponse({ type: [TaskDto] })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListTasksQueryDto,
  ): Promise<TaskDto[]> {
    return this.tasksService.list(user.id, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a task at the end of its day or the inbox' })
  @ApiOkResponse({ type: TaskDto })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTaskDto): Promise<TaskDto> {
    return this.tasksService.create(user.id, dto);
  }

  @Post('batch')
  @ApiOperation({ summary: 'Create several tasks at once' })
  @ApiOkResponse({ type: [TaskDto] })
  createMany(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTasksDto,
  ): Promise<TaskDto[]> {
    return this.tasksService.createMany(user.id, dto.tasks);
  }

  @Put('order')
  @ApiOperation({ summary: 'Place tasks on a day or in the inbox in the given order' })
  @ApiOkResponse({ type: [TaskDto] })
  order(@CurrentUser() user: AuthenticatedUser, @Body() dto: OrderTasksDto): Promise<TaskDto[]> {
    return this.tasksService.order(user.id, dto);
  }

  @Put('schedule')
  @ApiOperation({ summary: 'Give tasks of a day their start times and order' })
  @ApiOkResponse({ type: [TaskDto] })
  schedule(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ScheduleDayDto,
  ): Promise<TaskDto[]> {
    return this.tasksService.schedule(user.id, dto);
  }

  @Post('carry-over')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Move unfinished tasks from earlier days to the given day' })
  @ApiOkResponse({ type: CarryOverResultDto })
  carryOver(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CarryOverDto,
  ): Promise<CarryOverResultDto> {
    return this.tasksService.carryOver(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit, complete, reopen or move a task' })
  @ApiOkResponse({ type: TaskDto })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
  ): Promise<TaskDto> {
    return this.tasksService.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a task' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.tasksService.remove(user.id, id);
  }
}
