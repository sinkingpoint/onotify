import { z } from "zod";

// An alert that comes in over the API.
export const PostableAlert = z.object({
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }).optional(),
  annotations: z.record(z.string(), z.string()),
  labels: z.record(z.string(), z.string()),
  generatorURL: z.string().optional(),
});

export const PostableAlerts = z.array(PostableAlert);
