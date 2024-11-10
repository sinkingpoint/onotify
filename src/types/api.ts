import { z } from "zod";

// An alert that comes in over the API.
export const PostableAlertSpec = z.object({
  startsAt: z
    .string()
    .datetime({ offset: true })
    .optional()
    .transform((s) => (s ? Date.parse(s) : undefined)),
  endsAt: z
    .string()
    .datetime({ offset: true })
    .optional()
    .transform((s) => (s ? Date.parse(s) : undefined)),
  annotations: z.record(z.string(), z.string()),
  labels: z.record(z.string(), z.string()),
  generatorURL: z.string().optional(),
});
export type PostableAlert = z.infer<typeof PostableAlertSpec>;

export const PostableAlertsSpec = z.array(PostableAlertSpec);
export type PostableAlerts = z.infer<typeof PostableAlertsSpec>;

export const MatcherSpec = z.object({
  name: z.string(),
  value: z.string(),
  isRegex: z.boolean(),
  isEqual: z.boolean().default(true),
});

export type Matcher = z.infer<typeof MatcherSpec>;

export const PostableSilenceSpec = z.object({
  id: z.string().optional(),
  matchers: z.array(MatcherSpec),
  startsAt: z
    .string()
    .datetime({ offset: true })
    .transform((s) => Date.parse(s)),
  endsAt: z
    .string()
    .datetime({ offset: true })
    .transform((s) => Date.parse(s)),
  createdBy: z.string().optional(),
  comment: z.string().optional(),
});

export type PostableSilence = z.infer<typeof PostableSilenceSpec>;
