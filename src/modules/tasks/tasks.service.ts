import { Injectable } from '@nestjs/common';
import { Prisma, TaskStatus, type Task } from '@prisma/client';

import { parseLocalDate, toLocalDateString, todayInTimeZone } from '../../common/date/local-date';
import { ErrorCode, notFound } from '../../common/errors/error-code';
import { PrismaService } from '../../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import type {
  CarryOverDto,
  CarryOverResultDto,
  CreateTaskDto,
  ListTasksQueryDto,
  OrderTasksDto,
  ScheduleDayDto,
  TaskDto,
  UpdateTaskDto,
} from './dto/task.dto';

const LIST_ORDER: Prisma.TaskOrderByWithRelationInput[] = [
  { date: 'asc' },
  { position: 'asc' },
  { createdAt: 'asc' },
];

const toDateColumn = (value: string | null | undefined): Date | null | undefined =>
  value === undefined ? undefined : value === null ? null : parseLocalDate(value);

export const toTaskDto = (task: Task): TaskDto => ({
  id: task.id,
  title: task.title,
  notes: task.notes,
  date: task.date ? toLocalDateString(task.date) : null,
  startMinutes: task.startMinutes,
  durationMinutes: task.durationMinutes,
  priority: task.priority,
  status: task.status,
  position: task.position,
  completedAt: task.completedAt?.toISOString() ?? null,
  projectId: task.projectId,
  createdAt: task.createdAt.toISOString(),
});

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
  ) {}

  async list(userId: string, query: ListTasksQueryDto): Promise<TaskDto[]> {
    const where: Prisma.TaskWhereInput = { userId };

    if (query.projectId) {
      where.projectId = query.projectId;
    }

    if (query.scope === 'inbox') {
      where.date = null;
    } else if (query.scope === 'overdue') {
      const today = await this.todayFor(userId);
      where.status = TaskStatus.OPEN;
      where.date = { lt: parseLocalDate(today) };
    } else if (query.from || query.to) {
      where.date = {
        ...(query.from ? { gte: parseLocalDate(query.from) } : {}),
        ...(query.to ? { lte: parseLocalDate(query.to) } : {}),
      };
    }

    const tasks = await this.prisma.task.findMany({ where, orderBy: LIST_ORDER });

    return tasks.map(toTaskDto);
  }

  async create(userId: string, dto: CreateTaskDto): Promise<TaskDto> {
    const [task] = await this.createMany(userId, [dto]);
    return task;
  }

  async createMany(userId: string, items: CreateTaskDto[]): Promise<TaskDto[]> {
    await this.assertProjects(
      userId,
      items.map((item) => item.projectId),
    );

    const created = await this.prisma.$transaction(async (tx) => {
      const results: Task[] = [];

      for (const item of items) {
        const date = toDateColumn(item.date) ?? null;

        results.push(
          await tx.task.create({
            data: {
              userId,
              title: item.title.trim(),
              notes: item.notes?.trim() || null,
              date,
              startMinutes: item.startMinutes ?? null,
              durationMinutes: item.durationMinutes ?? null,
              priority: item.priority,
              projectId: item.projectId ?? null,
              position: await this.nextPosition(tx, userId, date),
            },
          }),
        );
      }

      return results;
    });

    return created.map(toTaskDto);
  }

  async update(userId: string, taskId: string, dto: UpdateTaskDto): Promise<TaskDto> {
    const current = await this.findOwned(userId, taskId);
    await this.assertProjects(userId, [dto.projectId]);

    const date = toDateColumn(dto.date);
    const movesContainer =
      date !== undefined && (date?.getTime() ?? null) !== (current.date?.getTime() ?? null);

    const completedAt =
      dto.status === undefined || dto.status === current.status
        ? undefined
        : dto.status === TaskStatus.DONE
          ? new Date()
          : null;

    const task = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        title: dto.title?.trim(),
        notes: dto.notes === undefined ? undefined : dto.notes?.trim() || null,
        date,
        startMinutes: dto.startMinutes,
        durationMinutes: dto.durationMinutes,
        priority: dto.priority,
        status: dto.status,
        completedAt,
        projectId: dto.projectId,
        position: movesContainer
          ? await this.nextPosition(this.prisma, userId, date ?? null)
          : undefined,
      },
    });

    return toTaskDto(task);
  }

  async remove(userId: string, taskId: string): Promise<void> {
    await this.findOwned(userId, taskId);
    await this.prisma.task.delete({ where: { id: taskId } });
  }

  async order(userId: string, dto: OrderTasksDto): Promise<TaskDto[]> {
    const ids = [...new Set(dto.taskIds)];
    await this.assertTasks(userId, ids);

    const date = toDateColumn(dto.date) ?? null;

    await this.prisma.$transaction(
      ids.map((id, position) =>
        this.prisma.task.update({ where: { id }, data: { date, position } }),
      ),
    );

    return this.list(userId, dto.date ? { from: dto.date, to: dto.date } : { scope: 'inbox' });
  }

  async schedule(userId: string, dto: ScheduleDayDto): Promise<TaskDto[]> {
    const items = [...dto.items].sort((a, b) => a.startMinutes - b.startMinutes);
    const scheduledIds = items.map((item) => item.taskId);
    await this.assertTasks(userId, scheduledIds);

    const date = parseLocalDate(dto.date);
    const rest = await this.prisma.task.findMany({
      where: { userId, date, id: { notIn: scheduledIds } },
      orderBy: { position: 'asc' },
      select: { id: true },
    });

    await this.prisma.$transaction([
      ...items.map((item, position) =>
        this.prisma.task.update({
          where: { id: item.taskId },
          data: {
            date,
            position,
            startMinutes: item.startMinutes,
            durationMinutes: item.durationMinutes,
          },
        }),
      ),
      ...rest.map((task, index) =>
        this.prisma.task.update({
          where: { id: task.id },
          data: { position: items.length + index },
        }),
      ),
    ]);

    return this.list(userId, { from: dto.date, to: dto.date });
  }

  async carryOver(userId: string, dto: CarryOverDto): Promise<CarryOverResultDto> {
    const target = parseLocalDate(dto.to);

    const moved = await this.prisma.$transaction(async (tx) => {
      const overdue = await tx.task.findMany({
        where: { userId, status: TaskStatus.OPEN, date: { lt: target } },
        orderBy: LIST_ORDER,
        select: { id: true },
      });

      let position = await this.nextPosition(tx, userId, target);

      for (const task of overdue) {
        await tx.task.update({
          where: { id: task.id },
          data: { date: target, position, startMinutes: null },
        });
        position += 1;
      }

      return overdue.length;
    });

    return { moved };
  }

  async todayFor(userId: string): Promise<string> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { timezone: true },
    });

    return todayInTimeZone(user.timezone);
  }

  private async findOwned(userId: string, taskId: string): Promise<Task> {
    const task = await this.prisma.task.findFirst({ where: { id: taskId, userId } });

    if (!task) {
      throw notFound(ErrorCode.TaskNotFound, 'Task not found');
    }

    return task;
  }

  private async assertTasks(userId: string, ids: string[]): Promise<void> {
    const owned = await this.prisma.task.count({ where: { userId, id: { in: ids } } });

    if (owned !== new Set(ids).size) {
      throw notFound(ErrorCode.TaskNotFound, 'Task not found');
    }
  }

  private async assertProjects(userId: string, ids: (string | null | undefined)[]): Promise<void> {
    const unique = [...new Set(ids.filter((id): id is string => typeof id === 'string'))];

    await Promise.all(unique.map((id) => this.projects.findOwned(userId, id)));
  }

  private async nextPosition(
    client: Prisma.TransactionClient,
    userId: string,
    date: Date | null,
  ): Promise<number> {
    const last = await client.task.aggregate({
      where: { userId, date },
      _max: { position: true },
    });

    return (last._max.position ?? -1) + 1;
  }
}
