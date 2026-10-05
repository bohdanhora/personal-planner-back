import type { Locale, Project, ProjectArea, TaskPriority, TaskStatus } from '@prisma/client';

import { isValidLocalDate, weekdayOf } from '../../common/date/local-date';
import type { RawTaskDraft } from './assistant.schemas';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MAX_TITLE_LENGTH = 200;
const MAX_NOTES_LENGTH = 2000;
const MIN_DURATION = 5;
const MAX_DURATION = 480;
const DURATION_STEP = 5;
const CLOCK_PATTERN = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export interface ContextTask {
  id: string;
  title: string;
  date: string | null;
  startMinutes: number | null;
  durationMinutes: number | null;
  priority: TaskPriority;
  status: TaskStatus;
  projectId: string | null;
}

export interface ContextProject {
  id: string;
  name: string;
  code: string;
  area: ProjectArea;
}

export interface PlannerContext {
  today: string;
  date: string;
  timezone: string;
  locale: Locale;
  displayName: string | null;
  dayStartMinutes: number;
  dayEndMinutes: number;
  projects: ContextProject[];
  dayTasks: ContextTask[];
  upcoming: ContextTask[];
  overdue: ContextTask[];
  inbox: ContextTask[];
}

export interface TaskDraft {
  title: string;
  notes: string | null;
  date: string | null;
  startMinutes: number | null;
  durationMinutes: number | null;
  priority: TaskPriority;
  projectId: string | null;
}

export const formatClock = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

export const parseClock = (value: string | null): number | null => {
  const match = value ? CLOCK_PATTERN.exec(value.trim()) : null;
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

export const roundDuration = (value: number | null): number | null => {
  if (value === null || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  const rounded = Math.round(value / DURATION_STEP) * DURATION_STEP;
  return Math.min(MAX_DURATION, Math.max(MIN_DURATION, rounded));
};

const tidyTitle = (title: string): string =>
  title
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.。]+$/, '')
    .slice(0, MAX_TITLE_LENGTH);

export const sanitiseDraft = (raw: RawTaskDraft, projectIds: Set<string>): TaskDraft | null => {
  const title = tidyTitle(raw.title);

  if (!title) {
    return null;
  }

  return {
    title,
    notes: raw.notes?.trim().slice(0, MAX_NOTES_LENGTH) || null,
    date: raw.date && isValidLocalDate(raw.date) ? raw.date : null,
    startMinutes: parseClock(raw.startTime),
    durationMinutes: roundDuration(raw.durationMinutes),
    priority: raw.priority,
    projectId: raw.projectId && projectIds.has(raw.projectId) ? raw.projectId : null,
  };
};

export interface RawPlanItem {
  taskId: string;
  startTime: string;
  durationMinutes: number;
  note: string | null;
}

export interface PlanItem {
  taskId: string;
  startMinutes: number;
  durationMinutes: number;
  note: string | null;
}

const MINUTES_PER_DAY = 1440;

export const sanitisePlan = (items: RawPlanItem[], allowedIds: Set<string>): PlanItem[] => {
  const seen = new Set<string>();
  const result: PlanItem[] = [];

  for (const item of items) {
    const startMinutes = parseClock(item.startTime);
    const durationMinutes = roundDuration(item.durationMinutes);

    if (
      !allowedIds.has(item.taskId) ||
      seen.has(item.taskId) ||
      startMinutes === null ||
      durationMinutes === null
    ) {
      continue;
    }

    seen.add(item.taskId);
    result.push({
      taskId: item.taskId,
      startMinutes,
      durationMinutes: Math.min(durationMinutes, MINUTES_PER_DAY - startMinutes),
      note: item.note?.trim() || null,
    });
  }

  return result.sort((a, b) => a.startMinutes - b.startMinutes);
};

const describeTask = (task: ContextTask, projects: Map<string, ContextProject>): string => {
  const parts = [`id=${task.id}`, `"${task.title}"`, `priority=${task.priority}`];
  const project = task.projectId ? projects.get(task.projectId) : undefined;

  if (project) {
    parts.push(`project=${project.code}`);
  }

  if (task.date) {
    parts.push(`date=${task.date}`);
  }

  if (task.startMinutes !== null) {
    parts.push(`start=${formatClock(task.startMinutes)}`);
  }

  if (task.durationMinutes !== null) {
    parts.push(`estimate=${task.durationMinutes}m`);
  }

  if (task.status === 'DONE') {
    parts.push('done');
  }

  return `- ${parts.join(', ')}`;
};

const section = (title: string, lines: string[]): string =>
  `${title}:\n${lines.length > 0 ? lines.join('\n') : '- none'}`;

export const describeContext = (context: PlannerContext): string => {
  const projects = new Map(context.projects.map((project) => [project.id, project]));
  const describe = (task: ContextTask) => describeTask(task, projects);

  return [
    `Today is ${context.today} (${WEEKDAYS[weekdayOf(context.today)]}), timezone ${context.timezone}.`,
    `The day in focus is ${context.date} (${WEEKDAYS[weekdayOf(context.date)]}).`,
    `Working hours: ${formatClock(context.dayStartMinutes)} to ${formatClock(context.dayEndMinutes)}.`,
    context.displayName ? `The person is called ${context.displayName}.` : '',
    section(
      'Projects',
      context.projects.map(
        (project) =>
          `- id=${project.id}, code=${project.code}, "${project.name}", area=${project.area}`,
      ),
    ),
    section(`Tasks on ${context.date}`, context.dayTasks.map(describe)),
    section(`Tasks planned in the two weeks after ${context.date}`, context.upcoming.map(describe)),
    section('Overdue open tasks', context.overdue.map(describe)),
    section('Inbox, not yet planned', context.inbox.map(describe)),
  ]
    .filter(Boolean)
    .join('\n\n');
};

export const toContextProject = (project: Project): ContextProject => ({
  id: project.id,
  name: project.name,
  code: project.code,
  area: project.area,
});
