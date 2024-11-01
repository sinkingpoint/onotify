import { DateTime, Str } from "chanfana";
import { z } from "zod";

export const Task = z.object({
  name: Str({ example: "lorem" }),
  slug: Str(),
  description: Str({ required: false }),
  completed: z.boolean().default(false),
  due_date: DateTime(),
});

export const PostableAlert = z.object({
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }).optional(),
  annotations: z.record(z.string(), z.string()),
  labels: z.record(z.string(), z.string()),
  generatorURL: z.string().optional(),
});

export const PostableAlerts = z.array(PostableAlert);

const InternalServerError = {
  description: "Internal Server Error",
  "text/plain": {
    schema: z.string(),
  },
};

const BadRequest = {
  description: "Bad Request",
  "text/plain": {
    schema: z.string(),
  },
};

export const Errors = {
  "400": BadRequest,
  "500": InternalServerError,
};
