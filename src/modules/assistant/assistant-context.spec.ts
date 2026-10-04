import {
  describeContext,
  formatClock,
  parseClock,
  roundDuration,
  sanitiseDraft,
  sanitisePlan,
  type PlannerContext,
} from './assistant-context';

describe('clock helpers', () => {
  it('parses and formats 24 hour times', () => {
    expect(parseClock('09:30')).toBe(570);
    expect(parseClock('7:05')).toBe(425);
    expect(parseClock('24:00')).toBeNull();
    expect(parseClock(null)).toBeNull();
    expect(formatClock(570)).toBe('09:30');
  });

  it('rounds durations into the allowed range', () => {
    expect(roundDuration(42)).toBe(40);
    expect(roundDuration(2)).toBe(5);
    expect(roundDuration(900)).toBe(480);
    expect(roundDuration(0)).toBeNull();
    expect(roundDuration(null)).toBeNull();
  });
});

describe('sanitiseDraft', () => {
  const projects = new Set(['p1']);

  it('tidies the title and drops unknown references', () => {
    expect(
      sanitiseDraft(
        {
          title: '  Call   the dentist. ',
          notes: '  ',
          date: '2026-02-30',
          startTime: '14:00',
          durationMinutes: 17,
          priority: 'HIGH',
          projectId: 'missing',
        },
        projects,
      ),
    ).toEqual({
      title: 'Call the dentist',
      notes: null,
      date: null,
      startMinutes: 840,
      durationMinutes: 15,
      priority: 'HIGH',
      projectId: null,
    });
  });

  it('keeps valid fields and rejects empty titles', () => {
    const draft = sanitiseDraft(
      {
        title: 'Draft the plan',
        notes: 'Outline first',
        date: '2026-10-05',
        startTime: null,
        durationMinutes: null,
        priority: 'NORMAL',
        projectId: 'p1',
      },
      projects,
    );

    expect(draft?.date).toBe('2026-10-05');
    expect(draft?.projectId).toBe('p1');
    expect(sanitiseDraft({ ...draft!, title: ' . ', startTime: null }, projects)).toBeNull();
  });
});

describe('sanitisePlan', () => {
  it('keeps known tasks once, in time order', () => {
    const plan = sanitisePlan(
      [
        { taskId: 'b', startTime: '11:00', durationMinutes: 30, note: null },
        { taskId: 'a', startTime: '09:00', durationMinutes: 92, note: ' Deep work ' },
        { taskId: 'a', startTime: '15:00', durationMinutes: 30, note: null },
        { taskId: 'x', startTime: '10:00', durationMinutes: 30, note: null },
        { taskId: 'c', startTime: 'later', durationMinutes: 30, note: null },
      ],
      new Set(['a', 'b', 'c']),
    );

    expect(plan).toEqual([
      { taskId: 'a', startMinutes: 540, durationMinutes: 90, note: 'Deep work' },
      { taskId: 'b', startMinutes: 660, durationMinutes: 30, note: null },
    ]);
  });
});

describe('describeContext', () => {
  it('lists projects and tasks with their ids', () => {
    const context: PlannerContext = {
      today: '2026-10-04',
      date: '2026-10-05',
      timezone: 'Europe/Kyiv',
      locale: 'en',
      displayName: 'Ann',
      dayStartMinutes: 540,
      dayEndMinutes: 1080,
      projects: [{ id: 'p1', name: 'Work', code: 'WORK', area: 'WORK' }],
      dayTasks: [
        {
          id: 't1',
          title: 'Write report',
          date: '2026-10-05',
          startMinutes: 600,
          durationMinutes: 60,
          priority: 'HIGH',
          status: 'OPEN',
          projectId: 'p1',
        },
      ],
      overdue: [],
      inbox: [],
    };

    const text = describeContext(context);

    expect(text).toContain('Today is 2026-10-04 (Sunday)');
    expect(text).toContain('Working hours: 09:00 to 18:00');
    expect(text).toContain('id=t1, "Write report", priority=HIGH, project=WORK');
    expect(text).toContain('start=10:00, estimate=60m');
    expect(text).toContain('Overdue open tasks:\n- none');
  });
});
