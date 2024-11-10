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
