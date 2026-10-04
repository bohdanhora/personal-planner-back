import { Locale, PrismaClient, ProjectArea, TaskPriority, TaskStatus } from '@prisma/client';
import { hash } from 'bcrypt';

const prisma = new PrismaClient();

const HISTORY_DAYS = 45;
const DAY_MS = 86_400_000;

const PROJECTS = [
  { code: 'WORK', name: 'Work', area: ProjectArea.WORK },
  { code: 'WEB', name: 'Website relaunch', area: ProjectArea.WORK },
  { code: 'LIFE', name: 'Personal', area: ProjectArea.PERSONAL },
  { code: 'GYM', name: 'Health', area: ProjectArea.PERSONAL },
];

const TITLES: Record<string, string[]> = {
  WORK: [
    'Review pull requests',
    'Prepare weekly status update',
    'Sync with the design team',
    'Answer support escalations',
    'Plan the next sprint',
  ],
  WEB: [
    'Draft the new landing copy',
    'Fix layout on small screens',
    'Set up analytics events',
    'Test the checkout flow',
  ],
  LIFE: [
    'Buy groceries',
    'Call parents',
    'Pay utility bills',
    'Read for 30 minutes',
    'Clean the desk',
  ],
  GYM: ['Morning run', 'Strength workout', 'Stretch for 15 minutes', 'Book a physio session'],
};

const TODAY_PLAN = [
  {
    code: 'WORK',
    title: 'Prepare the quarterly report',
    duration: 90,
    priority: TaskPriority.HIGH,
    start: 600,
  },
  {
    code: 'WEB',
    title: 'Review the new hero section',
    duration: 45,
    priority: TaskPriority.NORMAL,
    start: null,
  },
  {
    code: 'WORK',
    title: 'Reply to the partner email',
    duration: 15,
    priority: TaskPriority.NORMAL,
    start: null,
  },
  { code: 'GYM', title: 'Evening run', duration: 40, priority: TaskPriority.LOW, start: 1110 },
  {
    code: 'LIFE',
    title: 'Order a birthday gift for Anna',
    duration: 20,
    priority: TaskPriority.HIGH,
    start: null,
  },
];

const INBOX = ['Renew the passport', 'Find a Spanish tutor', 'Sort old photos'];

const random = (() => {
  let state = 42;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
})();

const utcMidnight = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

async function main(): Promise<void> {
  if (process.env.SEED_DEMO_USER !== 'true') {
    return;
  }

  const email = (process.env.SEED_DEMO_EMAIL ?? 'admin@admin.com').toLowerCase();
  const password = process.env.SEED_DEMO_PASSWORD ?? 'ChangeMe123';

  await prisma.user.deleteMany({ where: { email } });

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hash(password, 12),
      emailVerifiedAt: new Date(),
      displayName: 'Admin',
      locale: Locale.en,
      timezone: 'Europe/Kyiv',
    },
  });

  const projects = new Map<string, string>();

  for (const [position, project] of PROJECTS.entries()) {
    const created = await prisma.project.create({
      data: { userId: user.id, position, ...project },
    });
    projects.set(project.code, created.id);
  }

  const today = utcMidnight(new Date());
  const history = [];

  for (let offset = HISTORY_DAYS; offset >= 1; offset -= 1) {
    const date = new Date(today.getTime() - offset * DAY_MS);
    const isWeekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
    const count = isWeekend ? 1 + Math.floor(random() * 3) : 3 + Math.floor(random() * 4);

    for (let position = 0; position < count; position += 1) {
      const code = isWeekend
        ? random() > 0.3
          ? 'LIFE'
          : 'GYM'
        : (['WORK', 'WORK', 'WEB', 'LIFE', 'GYM'][Math.floor(random() * 5)] ?? 'WORK');
      const titles = TITLES[code];
      const done = random() < 0.78;
      const duration = [15, 30, 45, 60, 90][Math.floor(random() * 5)];

      if (!done && offset > 3) {
        continue;
      }

      history.push({
        userId: user.id,
        projectId: projects.get(code) ?? null,
        title: titles[Math.floor(random() * titles.length)],
        date,
        position,
        durationMinutes: duration,
        priority: random() > 0.8 ? TaskPriority.HIGH : TaskPriority.NORMAL,
        status: done ? TaskStatus.DONE : TaskStatus.OPEN,
        completedAt: done ? new Date(date.getTime() + (9 + position * 2) * 3_600_000) : null,
      });
    }
  }

  await prisma.task.createMany({ data: history });

  await prisma.task.createMany({
    data: [
      ...TODAY_PLAN.map((task, position) => ({
        userId: user.id,
        projectId: projects.get(task.code) ?? null,
        title: task.title,
        date: today,
        position,
        durationMinutes: task.duration,
        startMinutes: task.start,
        priority: task.priority,
      })),
      ...INBOX.map((title, position) => ({
        userId: user.id,
        title,
        date: null,
        position,
        projectId: projects.get('LIFE') ?? null,
      })),
    ],
  });
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`${String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
