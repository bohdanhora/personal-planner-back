import { Injectable } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';

import { parseLocalDate, todayInTimeZone } from '../../common/date/local-date';
import { PrismaService } from '../../prisma/prisma.service';
import { InsightsService } from '../insights/insights.service';
import { toTaskDto } from '../tasks/tasks.service';
import { AssistantClientService, type AssistantMessage } from './assistant-client.service';
import {
  describeContext,
  sanitiseDraft,
  sanitisePlan,
  toContextProject,
  type ContextTask,
  type PlannerContext,
  type TaskDraft,
} from './assistant-context';
import type {
  ChatReplyDto,
  ChatRequestDto,
  DraftsDto,
  ParseRequestDto,
  PlanDto,
  SuggestRequestDto,
  SuggestionDto,
  TipsDto,
} from './assistant.dto';
import {
  chatSystemPrompt,
  parseSystemPrompt,
  planSystemPrompt,
  suggestSystemPrompt,
  tipsSystemPrompt,
} from './assistant.prompts';
import {
  chatResultSchema,
  parseResultSchema,
  planResultSchema,
  suggestResultSchema,
  tipsResultSchema,
  type RawTaskDraft,
} from './assistant.schemas';

const CONTEXT_LIST_LIMIT = 40;
const MAX_DRAFTS = 12;
const MAX_TIPS = 4;

@Injectable()
export class AssistantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly client: AssistantClientService,
    private readonly insights: InsightsService,
  ) {}

  async parse(userId: string, dto: ParseRequestDto): Promise<DraftsDto> {
    const context = await this.buildContext(userId, dto.date);
    const result = await this.client.generate(userId, {
      system: parseSystemPrompt(context.locale),
      schema: parseResultSchema,
      messages: [
        {
          role: 'user',
          content: `${describeContext(context)}\n\nThe note to turn into tasks:\n${dto.text}`,
        },
      ],
    });

    return { drafts: this.cleanDrafts(result.drafts, context) };
  }

  async suggest(userId: string, dto: SuggestRequestDto): Promise<SuggestionDto> {
    const context = await this.buildContext(userId, dto.date);
    const result = await this.client.generate(userId, {
      system: suggestSystemPrompt(context.locale),
      schema: suggestResultSchema,
      messages: [
        {
          role: 'user',
          content: `${describeContext(context)}\n\nThe task being filled in:\nTitle: ${dto.title}\nNotes: ${dto.notes ?? 'none'}`,
        },
      ],
    });

    const [draft] = this.cleanDrafts([result.draft], context);

    return {
      draft: draft ?? {
        title: dto.title.trim(),
        notes: dto.notes?.trim() || null,
        date: null,
        startMinutes: null,
        durationMinutes: null,
        priority: 'NORMAL',
        projectId: null,
      },
    };
  }

  async plan(userId: string, date?: string): Promise<PlanDto> {
    const context = await this.buildContext(userId, date);
    const open = context.dayTasks.filter((task) => task.status === TaskStatus.OPEN);

    if (open.length === 0) {
      return { date: context.date, summary: '', items: [], unscheduled: [] };
    }

    const result = await this.client.generate(userId, {
      system: planSystemPrompt(context.locale),
      schema: planResultSchema,
      messages: [
        {
          role: 'user',
          content: `${describeContext(context)}\n\nPlan the open tasks of ${context.date}.`,
        },
      ],
    });

    const allowed = new Set(open.map((task) => task.id));
    const items = sanitisePlan(result.items, allowed);
    const scheduled = new Set(items.map((item) => item.taskId));

    return {
      date: context.date,
      summary: result.summary.trim(),
      items,
      unscheduled: result.unscheduled.filter(
        (entry) => allowed.has(entry.taskId) && !scheduled.has(entry.taskId),
      ),
    };
  }

  async tips(userId: string, date?: string): Promise<TipsDto> {
    const context = await this.buildContext(userId, date);
    const stats = await this.insights.summary(userId, 30);

    const statsText = [
      `Last 30 days: ${stats.completed} tasks completed, ${stats.completionRate}% of planned tasks done, ${stats.focusMinutes} estimated minutes of finished work.`,
      `Current streak ${stats.currentStreak} days, best ${stats.bestStreak}. Overdue open tasks: ${stats.overdue}. Inbox: ${stats.inbox}.`,
      `Average completions per weekday, Monday first: ${stats.byWeekday.join(', ')}.`,
    ].join('\n');

    const result = await this.client.generate(userId, {
      system: tipsSystemPrompt(context.locale),
      schema: tipsResultSchema,
      messages: [
        {
          role: 'user',
          content: `${describeContext(context)}\n\nRecent statistics:\n${statsText}`,
        },
      ],
    });

    return {
      tips: result.tips
        .map((tip) => ({ title: tip.title.trim(), body: tip.body.trim() }))
        .filter((tip) => tip.title && tip.body)
        .slice(0, MAX_TIPS),
    };
  }

  async chat(userId: string, dto: ChatRequestDto): Promise<ChatReplyDto> {
    const context = await this.buildContext(userId, dto.date);
    const [first, ...rest] = dto.messages;

    const messages: AssistantMessage[] = [
      {
        role: first.role,
        content:
          first.role === 'user' ? `${describeContext(context)}\n\n${first.content}` : first.content,
      },
      ...rest.map((message): AssistantMessage => ({
        role: message.role,
        content: message.content,
      })),
    ];

    if (messages[0].role !== 'user') {
      messages.unshift({ role: 'user', content: describeContext(context) });
    }

    const result = await this.client.generate(userId, {
      system: chatSystemPrompt(context.locale),
      schema: chatResultSchema,
      messages,
    });

    return { reply: result.reply.trim(), drafts: this.cleanDrafts(result.drafts, context) };
  }

  private cleanDrafts(drafts: RawTaskDraft[], context: PlannerContext): TaskDraft[] {
    const projectIds = new Set(context.projects.map((project) => project.id));

    return drafts
      .map((draft) => sanitiseDraft(draft, projectIds))
      .filter((draft): draft is TaskDraft => draft !== null)
      .slice(0, MAX_DRAFTS);
  }

  private async buildContext(userId: string, date?: string): Promise<PlannerContext> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const today = todayInTimeZone(user.timezone);
    const focus = date ?? today;

    const [projects, dayTasks, overdue, inbox] = await Promise.all([
      this.prisma.project.findMany({
        where: { userId, archivedAt: null },
        orderBy: { position: 'asc' },
      }),
      this.prisma.task.findMany({
        where: { userId, date: parseLocalDate(focus) },
        orderBy: { position: 'asc' },
        take: CONTEXT_LIST_LIMIT,
      }),
      this.prisma.task.findMany({
        where: { userId, status: TaskStatus.OPEN, date: { lt: parseLocalDate(today) } },
        orderBy: { date: 'desc' },
        take: CONTEXT_LIST_LIMIT,
      }),
      this.prisma.task.findMany({
        where: { userId, status: TaskStatus.OPEN, date: null },
        orderBy: { position: 'asc' },
        take: CONTEXT_LIST_LIMIT,
      }),
    ]);

    const toContextTask = (task: Parameters<typeof toTaskDto>[0]): ContextTask => {
      const dto = toTaskDto(task);
      return {
        id: dto.id,
        title: dto.title,
        date: dto.date,
        startMinutes: dto.startMinutes,
        durationMinutes: dto.durationMinutes,
        priority: dto.priority,
        status: dto.status,
        projectId: dto.projectId,
      };
    };

    return {
      today,
      date: focus,
      timezone: user.timezone,
      locale: user.locale,
      displayName: user.displayName,
      dayStartMinutes: user.dayStartMinutes,
      dayEndMinutes: user.dayEndMinutes,
      projects: projects.map(toContextProject),
      dayTasks: dayTasks.map(toContextTask),
      overdue: overdue.map(toContextTask),
      inbox: inbox.map(toContextTask),
    };
  }
}
