import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type {
  AdminField,
  AdminStats,
  AdminTable,
  AdminUserDetail,
  AdminUserList,
  AdminUserSummary,
} from './admin.contract';
import type { AdminUsersQueryDto } from './dto/admin-users-query.dto';

const DAY_MS = 86_400_000;
const RECENT_ROWS = 50;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const daysAgo = (days: number): Date => new Date(Date.now() - days * DAY_MS);

const isoDate = (value: Date | null | undefined): string | null =>
  value ? value.toISOString().slice(0, 10) : null;

const isoDateTime = (value: Date | null | undefined): string | null =>
  value ? value.toISOString() : null;

const clock = (minutes: number | null | undefined): string | null =>
  minutes === null || minutes === undefined
    ? null
    : `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

const summarySelect = {
  id: true,
  email: true,
  displayName: true,
  passwordHash: true,
  googleId: true,
  createdAt: true,
  refreshTokens: { select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
} satisfies Prisma.UserSelect;

type SummaryRecord = Prisma.UserGetPayload<{ select: typeof summarySelect }>;

const toSummary = (user: SummaryRecord): AdminUserSummary => ({
  id: user.id,
  email: user.email,
  name: user.displayName,
  createdAt: user.createdAt.toISOString(),
  lastActiveAt: isoDateTime(user.refreshTokens[0]?.createdAt),
  authMethods: [...(user.passwordHash ? ['password'] : []), ...(user.googleId ? ['google'] : [])],
});

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(): Promise<AdminStats> {
    const weekAgo = daysAgo(7);
    const [
      total,
      new7d,
      new30d,
      active7d,
      verified,
      onboarded,
      projects,
      tasks,
      tasksDone,
      tasksCreated7d,
      tasksCompleted7d,
    ] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      this.prisma.user.count({ where: { createdAt: { gte: daysAgo(30) } } }),
      this.prisma.user.count({
        where: { refreshTokens: { some: { createdAt: { gte: weekAgo } } } },
      }),
      this.prisma.user.count({ where: { emailVerifiedAt: { not: null } } }),
      this.prisma.user.count({ where: { onboardedAt: { not: null } } }),
      this.prisma.project.count(),
      this.prisma.task.count(),
      this.prisma.task.count({ where: { status: 'DONE' } }),
      this.prisma.task.count({ where: { createdAt: { gte: weekAgo } } }),
      this.prisma.task.count({ where: { completedAt: { gte: weekAgo } } }),
    ]);

    return {
      users: { total, new7d, new30d, active7d },
      metrics: [
        { label: 'Verified emails', value: verified, kind: 'number' },
        { label: 'Onboarded users', value: onboarded, kind: 'number' },
        { label: 'Projects', value: projects, kind: 'number' },
        { label: 'Tasks', value: tasks, kind: 'number' },
        { label: 'Tasks done', value: tasksDone, kind: 'number' },
        { label: 'Tasks created, 7 days', value: tasksCreated7d, kind: 'number' },
        { label: 'Tasks completed, 7 days', value: tasksCompleted7d, kind: 'number' },
      ],
    };
  }

  async listUsers(query: AdminUsersQueryDto): Promise<AdminUserList> {
    const where: Prisma.UserWhereInput = query.search
      ? {
          OR: [
            { email: { contains: query.search, mode: 'insensitive' } },
            { displayName: { contains: query.search, mode: 'insensitive' } },
            ...(UUID_PATTERN.test(query.search) ? [{ id: query.search }] : []),
          ],
        }
      : {};

    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: summarySelect,
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.offset,
      }),
    ]);

    return {
      items: users.map(toSummary),
      meta: {
        total,
        limit: query.limit,
        offset: query.offset,
        hasMore: query.offset + query.limit < total,
      },
    };
  }

  async getUser(id: string): Promise<AdminUserDetail> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        ...summarySelect,
        emailVerifiedAt: true,
        onboardedAt: true,
        locale: true,
        timezone: true,
        dayStartMinutes: true,
        dayEndMinutes: true,
        updatedAt: true,
        verification: { select: { sentAt: true, attempts: true, expiresAt: true } },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const now = new Date();
    const weekAgo = daysAgo(7);
    const today = new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
    const where = { userId: id };

    const [
      projects,
      tasks,
      sessions,
      projectCount,
      archivedProjects,
      taskCount,
      openTasks,
      doneTasks,
      completed7d,
      overdue,
      sessionCount,
    ] = await Promise.all([
      this.prisma.project.findMany({
        where,
        orderBy: [{ archivedAt: 'asc' }, { position: 'asc' }],
        take: RECENT_ROWS,
        include: { _count: { select: { tasks: true } } },
      }),
      this.prisma.task.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: RECENT_ROWS,
        include: { project: { select: { code: true } } },
      }),
      this.prisma.refreshToken.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: RECENT_ROWS,
        select: { createdAt: true, expiresAt: true, revokedAt: true, rotatedAt: true },
      }),
      this.prisma.project.count({ where }),
      this.prisma.project.count({ where: { ...where, archivedAt: { not: null } } }),
      this.prisma.task.count({ where }),
      this.prisma.task.count({ where: { ...where, status: 'OPEN' } }),
      this.prisma.task.count({ where: { ...where, status: 'DONE' } }),
      this.prisma.task.count({ where: { ...where, completedAt: { gte: weekAgo } } }),
      this.prisma.task.count({ where: { ...where, status: 'OPEN', date: { lt: today } } }),
      this.prisma.refreshToken.count({ where }),
    ]);

    const activeSessions = sessions.filter(
      (session) => !session.revokedAt && !session.rotatedAt && session.expiresAt > now,
    ).length;

    const account: AdminField[] = [
      { label: 'ID', value: user.id },
      { label: 'Email', value: user.email, kind: 'email' },
      { label: 'Email verified', value: isoDateTime(user.emailVerifiedAt), kind: 'datetime' },
      { label: 'Password sign-in', value: Boolean(user.passwordHash), kind: 'boolean' },
      { label: 'Google sign-in', value: Boolean(user.googleId), kind: 'boolean' },
      { label: 'Registered', value: user.createdAt.toISOString(), kind: 'datetime' },
      { label: 'Updated', value: user.updatedAt.toISOString(), kind: 'datetime' },
      {
        label: 'Last session',
        value: isoDateTime(user.refreshTokens[0]?.createdAt),
        kind: 'datetime',
      },
      { label: 'Active sessions', value: activeSessions, kind: 'number' },
      ...(user.verification
        ? [
            {
              label: 'Code sent',
              value: user.verification.sentAt.toISOString(),
              kind: 'datetime' as const,
            },
            {
              label: 'Code attempts',
              value: user.verification.attempts,
              kind: 'number' as const,
            },
          ]
        : []),
    ];

    const preferences: AdminField[] = [
      { label: 'Display name', value: user.displayName },
      { label: 'Language', value: user.locale },
      { label: 'Timezone', value: user.timezone },
      { label: 'Day starts', value: clock(user.dayStartMinutes) },
      { label: 'Day ends', value: clock(user.dayEndMinutes) },
      { label: 'Onboarded', value: isoDateTime(user.onboardedAt), kind: 'datetime' },
    ];

    const usage: AdminField[] = [
      { label: 'Projects', value: projectCount, kind: 'number' },
      { label: 'Archived projects', value: archivedProjects, kind: 'number' },
      { label: 'Tasks', value: taskCount, kind: 'number' },
      { label: 'Open', value: openTasks, kind: 'number' },
      { label: 'Done', value: doneTasks, kind: 'number' },
      { label: 'Completed, 7 days', value: completed7d, kind: 'number' },
      { label: 'Overdue', value: overdue, kind: 'number' },
    ];

    const projectsTable: AdminTable = {
      columns: [
        { key: 'code', label: 'Code' },
        { key: 'name', label: 'Project' },
        { key: 'area', label: 'Area' },
        { key: 'tasks', label: 'Tasks', kind: 'number' },
        { key: 'archived', label: 'Archived', kind: 'datetime' },
        { key: 'created', label: 'Created', kind: 'datetime' },
      ],
      rows: projects.map((project) => ({
        code: project.code,
        name: project.name,
        area: project.area,
        tasks: project._count.tasks,
        archived: isoDateTime(project.archivedAt),
        created: project.createdAt.toISOString(),
      })),
      total: projectCount,
    };

    const tasksTable: AdminTable = {
      columns: [
        { key: 'date', label: 'Day', kind: 'date' },
        { key: 'time', label: 'Time' },
        { key: 'title', label: 'Task' },
        { key: 'project', label: 'Project' },
        { key: 'priority', label: 'Priority' },
        { key: 'status', label: 'Status' },
        { key: 'completed', label: 'Completed', kind: 'datetime' },
        { key: 'updated', label: 'Updated', kind: 'datetime' },
      ],
      rows: tasks.map((task) => ({
        date: isoDate(task.date),
        time:
          task.startMinutes === null
            ? null
            : task.durationMinutes
              ? `${clock(task.startMinutes)} - ${clock(task.startMinutes + task.durationMinutes)}`
              : clock(task.startMinutes),
        title: task.title,
        project: task.project?.code ?? null,
        priority: task.priority,
        status: task.status,
        completed: isoDateTime(task.completedAt),
        updated: task.updatedAt.toISOString(),
      })),
      total: taskCount,
    };

    const sessionsTable: AdminTable = {
      columns: [
        { key: 'created', label: 'Issued', kind: 'datetime' },
        { key: 'expires', label: 'Expires', kind: 'datetime' },
        { key: 'state', label: 'State' },
      ],
      rows: sessions.map((session) => ({
        created: session.createdAt.toISOString(),
        expires: session.expiresAt.toISOString(),
        state: session.revokedAt
          ? 'revoked'
          : session.rotatedAt
            ? 'rotated'
            : session.expiresAt <= now
              ? 'expired'
              : 'active',
      })),
      total: sessionCount,
    };

    return {
      user: toSummary(user),
      sections: [
        { key: 'account', title: 'Account', fields: account },
        { key: 'preferences', title: 'Preferences', fields: preferences },
        { key: 'usage', title: 'Usage', fields: usage },
        { key: 'projects', title: 'Projects', table: projectsTable },
        { key: 'tasks', title: 'Tasks', table: tasksTable },
        { key: 'sessions', title: 'Sessions', table: sessionsTable },
      ],
    };
  }
}
