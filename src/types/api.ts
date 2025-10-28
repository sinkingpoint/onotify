import { z } from "zod";
import { getAnchoredRegex } from "../utils/regex";
import { StringMatcherSpec } from "./alertmanager";

// An alert that comes in over the API.
export const PostableAlertSpec = z
	.object({
		startsAt: z
			.string()
			.datetime({ offset: true })
			.optional()
			.transform((s) => (s ? Date.parse(s) : undefined))
			.openapi({
				description:
					"An RFC-3339 formatted timestamp indicating when the alert starts firing. Defaults to the time that we received the alert",
			}),
		endsAt: z
			.string()
			.datetime({ offset: true })
			.optional()
			.transform((s) => (s ? Date.parse(s) : undefined))
			.openapi({
				description: "An RFC-3339 formatted timestamp indicating when the alert finishes firing",
			}),
		annotations: z.record(z.string(), z.string()).openapi({
			description:
				"The annotations on the alert (e.g. the value of the evaluation). These can change, but are fixed to the same alert",
		}),
		labels: z.record(z.string(), z.string()).openapi({
			description: "The labels of the alert",
		}),
		generatorURL: z.string().optional().openapi({
			description: "An optional URL linking back to the origin of the alert",
		}),
	})
	.openapi({
		description: "An alert to add to the system",
	});
export type PostableAlert = z.infer<typeof PostableAlertSpec>;

export const PostableAlertsSpec = z.array(PostableAlertSpec);
export type PostableAlerts = z.infer<typeof PostableAlertsSpec>;

export const MatcherSpec = z
	.object({
		name: z.string(),
		value: z.string(),
		isRegex: z.boolean(),
		isEqual: z.boolean().default(true),
	})
	.openapi({
		description: "A matcher that can be used to match against alerts",
	});

export type Matcher = z.infer<typeof MatcherSpec>;

const silence = z.object({
	matchers: z
		.array(MatcherSpec)
		.openapi({
			description: "The matchers that match the alerts that this silence should silence",
		})
		.min(1),
	startsAt: z
		.string()
		.datetime({ offset: true })
		.transform((s) => Date.parse(s))
		.openapi({
			description:
				"An RFC-3339 formatting time string indicating the time that this silence should start silencing alerts",
		}),
	endsAt: z
		.string()
		.datetime({ offset: true })
		.transform((s) => Date.parse(s))
		.openapi({
			description:
				"An RFC-3339 formatting time string indicating the time that this silence should stop silencing alerts",
		}),
	createdBy: z.string().optional().openapi({
		description: "Who created this silence",
	}),
	comment: z.string().optional().openapi({
		description: "A comment that describes the silence",
	}),
});

export const PostableSilenceSpec = silence.extend({
	id: z.string().optional().openapi({
		description: "The ID of the silence to update",
	}),
});

export type PostableSilence = z.infer<typeof PostableSilenceSpec>;

export const GettableAlertReceiverSpec = z.object({
	name: z.string(),
});

export const GettableAlertStatusSpec = z.object({
	inhibitedBy: z.array(z.string()).openapi({
		description: "An array of inhibition rules that inhibit this alert",
	}),
	silencedBy: z.array(z.string()).openapi({
		description: "An array of silence ids that silence this alert",
	}),
	state: z.enum(["active", "supressed"]).openapi({
		description: "Whether this alert is firing or supressed",
	}),
});

export const GettableAlertHistoryEventSpec = z.object({
	ty: z.enum(["firing", "resolved", "acknowledged", "unacknowledged", "silenced", "unsilenced"]).openapi({
		description: "The type of the alert event",
	}),
	timestamp: z.string().datetime({ precision: 3, offset: true }).openapi({
		description: "An RFC-3339 formatted timestamp indicating when the event occurred",
	}),
});

export const GettableAlertCommentEventSpec = z.object({
	ty: z.literal("comment").openapi({
		description: "The type of the alert event",
	}),
	timestamp: z.string().datetime({ precision: 3, offset: true }).openapi({
		description: "An RFC-3339 formatted timestamp indicating when the event occurred",
	}),
	comment: z.string().openapi({
		description: "The comment that was added to the alert",
	}),
	userID: z.string().openapi({
		description: "The userID of the user that made the comment",
	}),
});

export const GettableAlertHistorySpec = z.union([GettableAlertHistoryEventSpec, GettableAlertCommentEventSpec]);
export type GettableAlertHistory = z.infer<typeof GettableAlertHistorySpec>;

export const GettableAlertSpec = z.object({
	fingerprint: z.string().openapi({
		description: "The fingerprint of the alert",
	}),
	labels: z.record(z.string(), z.string()).openapi({
		description: "The labels of the alert",
	}),
	acknowledgedBy: z.string().optional().openapi({
		description: "The userID of the user that acknowledged the alert",
	}),
	annotations: z.record(z.string(), z.string()).openapi({
		description: "The annotations of the alert",
	}),
	startsAt: z.string().datetime({ precision: 3, offset: true }).openapi({
		description: "An RFC-3339 formatting time string indicating the time that this alert started firing",
	}),
	endsAt: z.string().datetime({ precision: 3, offset: true }).openapi({
		description: "An RFC-3339 formatted timestamp indicating when the alert finishes firing",
	}),
	updatedAt: z.string().datetime({ precision: 3, offset: true }).openapi({
		description: "An RFC-3339 formatted timestamp indicating when the annotations of the alert were last updated",
	}),
	receivers: z.array(GettableAlertReceiverSpec).openapi({
		description: "The receivers that this alert is firing to",
	}),
	status: GettableAlertStatusSpec.openapi({
		description: "The state of the alert",
	}),
});

export const GettableAlertsSpec = z.array(GettableAlertSpec);

export type GettableAlert = z.infer<typeof GettableAlertSpec>;

const SilenceStatusSpec = z.object({
	state: z.enum(["expired", "active", "pending"]),
});

export const GettableSilenceSpec = silence.extend({
	id: z.string().openapi({
		description: "The ID assigned to the silence",
	}),
	status: SilenceStatusSpec.openapi({
		description: "The state of the alert - whether or not it is actively silencing alerts",
	}),
	updatedAt: z.string().datetime({ precision: 3, offset: true }).openapi({
		description: "An RFC-3339 formatted timestamp indicating when the silence was last updated",
	}),
});

export type GettableSilence = z.infer<typeof GettableSilenceSpec>;

export const GettableSilencesSpec = z.array(GettableSilenceSpec);

export const GetAlertGroupsOptionsSpec = z.object({
	active: z.boolean().default(true).openapi({
		description: "If true, return alerts that are not silenced, inhibited, or muted",
	}),
	silenced: z.boolean().default(true).openapi({
		description: "If true, return alerts that are silenced",
	}),
	inhibited: z.boolean().default(true).openapi({
		description: "If true, return alerts that are inhibited",
	}),
	muted: z.boolean().default(true).openapi({
		description: "If true, return alerts that are muted",
	}),
	filter: z.array(StringMatcherSpec).default([]).openapi({
		description:
			"A list of matchers to filter the alerts groups by. Only applies to the `group_by` alerts of the group",
	}),
	receiver: z
		.string()
		.describe("A regex matching receivers to filter by")
		.transform((r) => getAnchoredRegex(r))
		.optional()
		.openapi({
			description: "A regex to filter alert group receivers by",
		}),
});

export type GetAlertGroupsOptions = z.infer<typeof GetAlertGroupsOptionsSpec>;

export const RequiredFileSpec = z.object({
	path: z.string().openapi({ description: "the path in the alertmanager config" }),
	isDir: z.boolean().openapi({ description: "whether the path takes a directory (e.g. it's a glob)" }),
	uploaded: z.boolean().openapi({ description: "whether the file has already been uploaded" }),
});

export type RequiredFile = z.infer<typeof RequiredFileSpec>;

export const RequiredFilesSpec = z
	.object({
		secrets: z.array(RequiredFileSpec).openapi({ description: "the secret files that need to be uploaded" }),
		templates: z.array(RequiredFileSpec).openapi({ description: "the templates that need to be uploaded" }),
	})
	.openapi({ description: "the extra files required, as specified in the config" });

export type RequiredFiles = z.infer<typeof RequiredFilesSpec>;

const StringRegexp = z.string().transform((s) => new RegExp(s));

export const PostableRequiredFileSpec = z.object({
	path: z.string().openapi({ description: "the path that this file comes from" }),
	contents: z.string().openapi({ description: "the contents of the file" }),
});

export const GetAlertsParamsSpec = z.object({
	fingerprints: z.array(z.string()).optional(),
	active: z.boolean().default(true).openapi({ description: "Show active alerts" }),
	silenced: z.boolean().default(true).openapi({ description: "Show silenced alerts" }),
	resolved: z.boolean().default(false).openapi({ description: "Show resolved alerts" }),
	muted: z.boolean().default(true).openapi({ description: "Show muted alerts" }),
	inhibited: z.boolean().default(true).openapi({ description: "Show inhibited alerts" }),
	unprocessed: z.boolean().default(true).openapi({ description: "Show unprocessed alerts" }),
	filter: z.array(StringMatcherSpec).default([]).openapi({ description: "A list of matchers to filter by" }),
	receiver: StringRegexp.optional().openapi({ description: "A regex matching receivers to filter by" }),
	sort: z
		.array(
			z.enum([
				"startsAt:asc",
				"endsAt:asc",
				"updatedAt:asc",
				"alertname:asc",
				"startsAt:desc",
				"endsAt:desc",
				"updatedAt:desc",
				"alertname:desc",
			]),
		)
		.optional()
		.openapi({ description: "The field to sort by" }),
	limit: z.number().optional().openapi({ description: "The maximum number of alerts to return" }),
	page: z.number().optional().openapi({ description: "The page of alerts to return" }),
});

export type GetAlertsParams = z.infer<typeof GetAlertsParamsSpec>;

export const GetSilencesParamsSpec = z.object({
	id: z.array(z.string()).default([]).openapi({ description: "A list of silence IDs to fetch" }),
	filter: z.array(StringMatcherSpec).default([]).openapi({ description: "A list of matchers to filter by" }),
	active: z.boolean().default(true).openapi({ description: "Show active silences" }),
	expired: z.boolean().default(false).openapi({ description: "Show expired silences" }),
	sort: z
		.array(z.enum(["startsAt:asc", "endsAt:asc", "startsAt:desc", "endsAt:desc"]))
		.optional()
		.openapi({ description: "The fields to sort by" }),
	limit: z.number().optional().openapi({ description: "The maximum number of silences to return" }),
	page: z.number().optional().openapi({ description: "The page of silences to return" }),
});

export type GetSilencesParams = z.infer<typeof GetSilencesParamsSpec>;

export const GetStatsParamsSpec = z.object({
	startTime: z
		.string()
		.datetime({ offset: true })
		.transform((s) => Date.parse(s))
		.optional()
		.openapi({ description: "The start time of the stats" }),
	endTime: z
		.string()
		.datetime({ offset: true })
		.transform((s) => Date.parse(s))
		.optional()
		.openapi({ description: "The end time of the stats" }),
	aggregation: z.enum(["count"]).default("count").openapi({ description: "The aggregation to use" }),
	intervalSecs: z.number().optional().openapi({ description: "The interval to aggregate over" }),
	instant: z.boolean().default(false).openapi({ description: "If true, return the stats at the end time" }),
	filter: z.array(StringMatcherSpec).default([]).openapi({ description: "A list of matchers to filter by" }),

	// only valid for silences.
	expired: z.boolean().default(false),

	// only valid for alerts.
	active: z.boolean().default(true),
	silenced: z.boolean().default(false),
	inhibited: z.boolean().default(false),
	muted: z.boolean().default(false),
});

export type GetStatsParams = z.infer<typeof GetStatsParamsSpec>;

const StatsBucketSpec = z.object({
	time: z.string().datetime({ offset: true }).openapi({ description: "The time of the bucket" }),
	value: z.number().openapi({ description: "" }),
});

export type StatsBucket = z.infer<typeof StatsBucketSpec>;

export const StatsResponseSpec = z.object({
	buckets: z.array(StatsBucketSpec).openapi({ description: "The buckets of the stats" }),
});

export const PaginationHeaders = z.object({
	"X-Total-Count": z.number().int().positive().optional().openapi({ description: "Total number of items" }),
});

export const GetUserParamsSpec = z.object({
	userID: z.string().openapi({
		description: "The userID of the user to fetch",
	}),
});

export const GetAlertHistoryParamsSpec = z.object({
	startTime: z
		.string()
		.datetime({ offset: true })
		.transform((s) => Date.parse(s))
		.optional()
		.openapi({ description: "The start time of the history" }),
	endTime: z
		.string()
		.datetime({ offset: true })
		.transform((s) => Date.parse(s))
		.optional()
		.openapi({ description: "The end time of the history" }),
	page: z.number().optional().openapi({ description: "The page of history to return" }),
	pageSize: z.number().optional().openapi({ description: "The number of history events per page" }),
});

export const GettableUserTokenSpec = z.object({
	id: z.string().openapi({
		description: "The ID of the token",
	}),
	name: z.string().openapi({
		description: "The name of the token",
	}),
	createdAt: z.string().datetime({ precision: 3, offset: true }).openapi({
		description: "An RFC-3339 formatted timestamp indicating when the token was created",
	}),
	scopes: z.array(z.string()).openapi({
		description: "The scopes that the token has",
	}),
	expiresAt: z.string().datetime({ precision: 3, offset: true }).openapi({
		description: "An RFC-3339 formatted timestamp indicating when the token expires",
	}),
});
