import { z } from 'zod';

export const taskDraftSchema = z.object({
  title: z.string(),
  notes: z.string().nullable(),
  date: z.string().nullable(),
  startTime: z.string().nullable(),
  durationMinutes: z.number().int().nullable(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH']),
  projectId: z.string().nullable(),
});

export type RawTaskDraft = z.infer<typeof taskDraftSchema>;

export const parseResultSchema = z.object({
  drafts: z.array(taskDraftSchema),
});

export const suggestResultSchema = z.object({
  draft: taskDraftSchema,
});

export const planResultSchema = z.object({
  summary: z.string(),
  items: z.array(
    z.object({
      taskId: z.string(),
      startTime: z.string(),
      durationMinutes: z.number().int(),
      note: z.string().nullable(),
    }),
  ),
  unscheduled: z.array(
    z.object({
      taskId: z.string(),
      reason: z.string(),
    }),
  ),
});

export const tipsResultSchema = z.object({
  tips: z.array(
    z.object({
      title: z.string(),
      body: z.string(),
    }),
  ),
});

export const chatResultSchema = z.object({
  reply: z.string(),
  drafts: z.array(taskDraftSchema),
});
