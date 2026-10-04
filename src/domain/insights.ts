import { addLocalDays, enumerateLocalDates, weekdayOf } from '../common/date/local-date';

export interface InsightTask {
  date: string | null;
  completedOn: string | null;
  durationMinutes: number | null;
  projectId: string | null;
}

export interface DailyPoint {
  date: string;
  planned: number;
  completed: number;
  focusMinutes: number;
}

export interface ProjectPoint {
  projectId: string | null;
  completed: number;
  open: number;
}

export interface InsightSummary {
  daily: DailyPoint[];
  byProject: ProjectPoint[];
  byWeekday: number[];
  completed: number;
  planned: number;
  completionRate: number;
  focusMinutes: number;
  currentStreak: number;
  bestStreak: number;
}

const MONDAY_FIRST = [6, 0, 1, 2, 3, 4, 5];

export const buildDailySeries = (tasks: InsightTask[], from: string, to: string): DailyPoint[] => {
  const points = new Map<string, DailyPoint>(
    enumerateLocalDates(from, to).map((date) => [
      date,
      { date, planned: 0, completed: 0, focusMinutes: 0 },
    ]),
  );

  for (const task of tasks) {
    const plannedDay = task.date ? points.get(task.date) : undefined;

    if (plannedDay) {
      plannedDay.planned += 1;
    }

    const completedDay = task.completedOn ? points.get(task.completedOn) : undefined;

    if (completedDay) {
      completedDay.completed += 1;
      completedDay.focusMinutes += task.durationMinutes ?? 0;
    }
  }

  return [...points.values()];
};

export const measureStreaks = (
  completedDays: Set<string>,
  today: string,
): { current: number; best: number } => {
  let cursor = completedDays.has(today) ? today : addLocalDays(today, -1);
  let current = 0;

  while (completedDays.has(cursor)) {
    current += 1;
    cursor = addLocalDays(cursor, -1);
  }

  const sorted = [...completedDays].sort();
  let best = 0;
  let run = 0;
  let previous: string | null = null;

  for (const day of sorted) {
    run = previous !== null && addLocalDays(previous, 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }

  return { current, best };
};

export const summariseInsights = (
  tasks: InsightTask[],
  from: string,
  to: string,
  today: string,
): InsightSummary => {
  const daily = buildDailySeries(tasks, from, to);
  const inRange = (date: string | null): date is string =>
    date !== null && date >= from && date <= to;

  const projects = new Map<string | null, ProjectPoint>();
  const weekdayTotals = Array.from({ length: 7 }, () => 0);
  const weekdayCounts = Array.from({ length: 7 }, () => 0);

  for (const point of daily) {
    const index = MONDAY_FIRST[weekdayOf(point.date)];
    weekdayTotals[index] += point.completed;
    weekdayCounts[index] += 1;
  }

  let plannedInRange = 0;
  let plannedDone = 0;

  for (const task of tasks) {
    const entry = projects.get(task.projectId) ?? {
      projectId: task.projectId,
      completed: 0,
      open: 0,
    };

    if (inRange(task.completedOn)) {
      entry.completed += 1;
    }

    if (task.completedOn === null) {
      entry.open += 1;
    }

    projects.set(task.projectId, entry);

    if (inRange(task.date)) {
      plannedInRange += 1;
      plannedDone += task.completedOn === null ? 0 : 1;
    }
  }

  const completedDays = new Set(
    tasks.map((task) => task.completedOn).filter((day): day is string => day !== null),
  );
  const streaks = measureStreaks(completedDays, today);

  return {
    daily,
    byProject: [...projects.values()]
      .filter((point) => point.completed > 0 || point.open > 0)
      .sort((a, b) => b.completed - a.completed || b.open - a.open),
    byWeekday: weekdayTotals.map((total, index) =>
      weekdayCounts[index] === 0 ? 0 : Math.round((total / weekdayCounts[index]) * 10) / 10,
    ),
    completed: daily.reduce((sum, point) => sum + point.completed, 0),
    planned: plannedInRange,
    completionRate: plannedInRange === 0 ? 0 : Math.round((plannedDone / plannedInRange) * 100),
    focusMinutes: daily.reduce((sum, point) => sum + point.focusMinutes, 0),
    currentStreak: streaks.current,
    bestStreak: streaks.best,
  };
};
