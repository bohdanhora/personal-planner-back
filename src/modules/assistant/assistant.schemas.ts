import { z } from 'zod';

const nullableText = z.string().nullable().default(null);

export const taskDraftSchema = z.object({
  title: z.string(),
  notes: nullableText,
  date: nullableText,
  startTime: nullableText,
  durationMinutes: z.number().nullable().default(null),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH']).default('NORMAL'),
  projectId: nullableText,
});

export type RawTaskDraft = z.infer<typeof taskDraftSchema>;

export const parseResultSchema = z.object({
  drafts: z.array(taskDraftSchema).default([]),
});

export const suggestResultSchema = z.object({
  draft: taskDraftSchema,
});

export const planResultSchema = z.object({
  summary: z.string().default(''),
  items: z
    .array(
      z.object({
        taskId: z.string(),
        startTime: z.string(),
        durationMinutes: z.number(),
        note: nullableText,
      }),
    )
    .default([]),
  unscheduled: z
    .array(
      z.object({
        taskId: z.string(),
        reason: z.string().default(''),
      }),
    )
    .default([]),
});

export const tipsResultSchema = z.object({
  tips: z
    .array(
      z.object({
        title: z.string(),
        body: z.string(),
      }),
    )
    .default([]),
});

export const chatResultSchema = z.object({
  reply: z.string(),
  drafts: z.array(taskDraftSchema).default([]),
});
