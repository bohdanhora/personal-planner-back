import { Injectable } from '@nestjs/common';
import { Prisma, TaskStatus, type Project } from '@prisma/client';

import { ErrorCode, conflict, notFound } from '../../common/errors/error-code';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CreateProjectDto,
  ProjectDto,
  ReorderProjectsDto,
  UpdateProjectDto,
} from './dto/project.dto';

interface TaskCounts {
  open: number;
  done: number;
}

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, includeArchived: boolean): Promise<ProjectDto[]> {
    const projects = await this.prisma.project.findMany({
      where: { userId, ...(includeArchived ? {} : { archivedAt: null }) },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });

    const counts = await this.countTasks(
      userId,
      projects.map((project) => project.id),
    );

    return projects.map((project) => this.toDto(project, counts.get(project.id)));
  }

  async get(userId: string, projectId: string): Promise<ProjectDto> {
    const project = await this.findOwned(userId, projectId);
    const counts = await this.countTasks(userId, [project.id]);

    return this.toDto(project, counts.get(project.id));
  }

  async create(userId: string, dto: CreateProjectDto): Promise<ProjectDto> {
    const last = await this.prisma.project.aggregate({
      where: { userId },
      _max: { position: true },
    });

    const project = await this.guardCode(() =>
      this.prisma.project.create({
        data: {
          userId,
          name: dto.name.trim(),
          code: dto.code,
          area: dto.area,
          description: dto.description?.trim() || null,
          position: (last._max.position ?? -1) + 1,
        },
      }),
    );

    return this.toDto(project);
  }

  async update(userId: string, projectId: string, dto: UpdateProjectDto): Promise<ProjectDto> {
    await this.findOwned(userId, projectId);

    await this.guardCode(() =>
      this.prisma.project.update({
        where: { id: projectId },
        data: {
          name: dto.name?.trim(),
          code: dto.code,
          area: dto.area,
          description: dto.description === undefined ? undefined : dto.description?.trim() || null,
          archivedAt: dto.archived === undefined ? undefined : dto.archived ? new Date() : null,
        },
      }),
    );

    return this.get(userId, projectId);
  }

  async remove(userId: string, projectId: string): Promise<void> {
    await this.findOwned(userId, projectId);
    await this.prisma.project.delete({ where: { id: projectId } });
  }

  async reorder(userId: string, dto: ReorderProjectsDto): Promise<ProjectDto[]> {
    const ids = [...new Set(dto.projectIds)];
    const owned = await this.prisma.project.count({ where: { userId, id: { in: ids } } });

    if (owned !== ids.length) {
      throw notFound(ErrorCode.ProjectNotFound, 'Project not found');
    }

    await this.prisma.$transaction(
      ids.map((id, position) => this.prisma.project.update({ where: { id }, data: { position } })),
    );

    return this.list(userId, true);
  }

  async findOwned(userId: string, projectId: string): Promise<Project> {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, userId } });

    if (!project) {
      throw notFound(ErrorCode.ProjectNotFound, 'Project not found');
    }

    return project;
  }

  private async guardCode<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw conflict(ErrorCode.ProjectCodeTaken, 'Another project already uses this code');
      }

      throw error;
    }
  }

  private async countTasks(userId: string, projectIds: string[]): Promise<Map<string, TaskCounts>> {
    const groups = await this.prisma.task.groupBy({
      by: ['projectId', 'status'],
      where: { userId, projectId: { in: projectIds } },
      _count: { _all: true },
    });

    const counts = new Map<string, TaskCounts>();

    for (const group of groups) {
      if (!group.projectId) {
        continue;
      }

      const entry = counts.get(group.projectId) ?? { open: 0, done: 0 };

      if (group.status === TaskStatus.DONE) {
        entry.done += group._count._all;
      } else {
        entry.open += group._count._all;
      }

      counts.set(group.projectId, entry);
    }

    return counts;
  }

  private toDto(project: Project, counts: TaskCounts = { open: 0, done: 0 }): ProjectDto {
    return {
      id: project.id,
      name: project.name,
      code: project.code,
      area: project.area,
      description: project.description,
      position: project.position,
      archived: project.archivedAt !== null,
      openTasks: counts.open,
      doneTasks: counts.done,
      createdAt: project.createdAt.toISOString(),
    };
  }
}
