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
	matchers: z.array(MatcherSpec).openapi({
		description: "The matchers that match the alerts that this silence should silence",
	}),
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

export const GettableAlertSpec = z.object({
	fingerprint: z.string().openapi({
		description: "The fingerprint of the alert",
	}),
	labels: z.record(z.string(), z.string()).openapi({
		description: "The labels of the alert",
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

const SilenceStatusSpec = z.enum(["expired", "active", "pending"]);
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

export const RequiredFilesSpec = z.object({
	secrets: z.array(RequiredFileSpec).openapi({ description: "the secret files that need to be uploaded" }),
	templates: z.array(RequiredFileSpec).openapi({ description: "the templates that need to be uploaded" }),
});

export type RequiredFiles = z.infer<typeof RequiredFilesSpec>;
