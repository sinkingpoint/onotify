import { z } from "zod";

// An alert that comes in over the API.
export const PostableAlertSpec = z.object({
  status: z.enum(["firing", "resolved"]),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }).optional(),
  annotations: z.record(z.string(), z.string()),
  labels: z.record(z.string(), z.string()),
  generatorURL: z.string().optional(),
});
export type PostableAlert = z.infer<typeof PostableAlertSpec>;

export const PostableAlertsSpec = z.array(PostableAlertSpec);
export type PostableAlerts = z.infer<typeof PostableAlertsSpec>;
