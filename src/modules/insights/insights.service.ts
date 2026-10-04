import { Injectable } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';

import {
  addLocalDays,
  toLocalDateInTimeZone,
  toLocalDateString,
  todayInTimeZone,
} from '../../common/date/local-date';
import { summariseInsights, type InsightTask } from '../../domain/insights';
import { PrismaService } from '../../prisma/prisma.service';
import type { InsightsDto } from './insights.dto';

const DEFAULT_RANGE_DAYS = 30;

@Injectable()
export class InsightsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(userId: string, days = DEFAULT_RANGE_DAYS): Promise<InsightsDto> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { timezone: true },
    });

    const today = todayInTimeZone(user.timezone);
    const from = addLocalDays(today, -(days - 1));

    const rows = await this.prisma.task.findMany({
      where: { userId },
      select: {
        date: true,
        status: true,
        completedAt: true,
        durationMinutes: true,
        projectId: true,
      },
    });

    const tasks: InsightTask[] = rows.map((row) => ({
      date: row.date ? toLocalDateString(row.date) : null,
      completedOn:
        row.status === TaskStatus.DONE && row.completedAt
          ? toLocalDateInTimeZone(row.completedAt, user.timezone)
          : null,
      durationMinutes: row.durationMinutes,
      projectId: row.projectId,
    }));

    const summary = summariseInsights(tasks, from, today, today);

    return {
      from,
      to: today,
      ...summary,
      overdue: tasks.filter(
        (task) => task.completedOn === null && task.date !== null && task.date < today,
      ).length,
      inbox: tasks.filter((task) => task.completedOn === null && task.date === null).length,
    };
  }
}
