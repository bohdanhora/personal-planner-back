import { buildDailySeries, measureStreaks, summariseInsights, type InsightTask } from './insights';

const task = (overrides: Partial<InsightTask>): InsightTask => ({
  date: null,
  completedOn: null,
  durationMinutes: null,
  projectId: null,
  ...overrides,
});

describe('buildDailySeries', () => {
  it('counts planned and completed tasks on their own days', () => {
    const series = buildDailySeries(
      [
        task({ date: '2026-10-01', completedOn: '2026-10-02', durationMinutes: 30 }),
        task({ date: '2026-10-02' }),
        task({ date: '2026-09-20', completedOn: '2026-10-03', durationMinutes: 45 }),
      ],
      '2026-10-01',
      '2026-10-03',
    );

    expect(series).toEqual([
      { date: '2026-10-01', planned: 1, completed: 0, focusMinutes: 0 },
      { date: '2026-10-02', planned: 1, completed: 1, focusMinutes: 30 },
      { date: '2026-10-03', planned: 0, completed: 1, focusMinutes: 45 },
    ]);
  });
});

describe('measureStreaks', () => {
  it('keeps the streak alive when today has no completions yet', () => {
    const days = new Set(['2026-10-01', '2026-10-02', '2026-10-03']);
    expect(measureStreaks(days, '2026-10-04')).toEqual({ current: 3, best: 3 });
  });

  it('finds the best run separately from the current one', () => {
    const days = new Set(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-10-04']);
    expect(measureStreaks(days, '2026-10-04')).toEqual({ current: 1, best: 4 });
  });

  it('is zero without recent completions', () => {
    expect(measureStreaks(new Set(['2026-09-01']), '2026-10-04').current).toBe(0);
  });
});

describe('summariseInsights', () => {
  it('derives totals, completion rate and project breakdown', () => {
    const summary = summariseInsights(
      [
        task({
          date: '2026-10-04',
          completedOn: '2026-10-04',
          projectId: 'a',
          durationMinutes: 60,
        }),
        task({ date: '2026-10-04', projectId: 'a' }),
        task({ date: '2026-10-03', completedOn: '2026-10-03', projectId: 'b' }),
        task({ date: null, projectId: 'b' }),
      ],
      '2026-09-28',
      '2026-10-04',
      '2026-10-04',
    );

    expect(summary.completed).toBe(2);
    expect(summary.planned).toBe(3);
    expect(summary.completionRate).toBe(67);
    expect(summary.focusMinutes).toBe(60);
    expect(summary.currentStreak).toBe(2);
    expect(summary.byProject).toEqual([
      { projectId: 'a', completed: 1, open: 1 },
      { projectId: 'b', completed: 1, open: 1 },
    ]);
    expect(summary.byWeekday).toHaveLength(7);
    expect(summary.byWeekday[6]).toBe(1);
  });
});
