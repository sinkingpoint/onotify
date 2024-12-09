import { z } from "zod";
import { StringMatcherSpec } from "./alertmanager";
import { getAnchoredRegex } from "../utils/regex";

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

const silence = z.object({
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

export const PostableSilenceSpec = silence.extend({
  id: z.string().optional(),
});

export type PostableSilence = z.infer<typeof PostableSilenceSpec>;

export const GettableAlertReceiverSpec = z.object({
  name: z.string(),
});

export const GettableAlertStatusSpec = z.object({
  inhibitedBy: z.array(z.string()),
  silencedBy: z.array(z.string()),
  state: z.enum(["active", "supressed"]),
});

export const GettableAlertSpec = z.object({
  fingerprint: z.string(),
  labels: z.record(z.string(), z.string()),
  annotations: z.record(z.string(), z.string()),
  startsAt: z.string().datetime({ precision: 3, offset: true }),
  endsAt: z.string().datetime({ precision: 3, offset: true }),
  updatedAt: z.string().datetime({ precision: 3, offset: true }),
  receivers: z.array(GettableAlertReceiverSpec),
  status: GettableAlertStatusSpec,
});

export const GettableAlertsSpec = z.array(GettableAlertSpec);

const SilenceStatusSpec = z.enum(["expired", "active", "pending"]);
export const GettableSilenceSpec = silence.extend({
  id: z.string(),
  status: SilenceStatusSpec,
  updatedAt: z.string().datetime({ precision: 3, offset: true }),
});

export const GettableSilencesSpec = z.array(GettableSilenceSpec);

export const GetAlertGroupsOptionsSpec = z.object({
  active: z.boolean().describe("Show active alerts").default(true),
  silenced: z.boolean().describe("Show silenced alerts").default(true),
  inhibited: z.boolean().describe("Show inhibited alerts").default(true),
  muted: z.boolean().describe("Show muted alerts").default(true),
  filter: z
    .array(StringMatcherSpec)
    .describe("A list of matchers to filter alerts by")
    .default([]),
  receiver: z
    .string()
    .describe("A regex matching receivers to filter by")
    .transform((r) => getAnchoredRegex(r))
    .optional(),
});

export type GetAlertGroupsOptions = z.infer<typeof GetAlertGroupsOptionsSpec>;
