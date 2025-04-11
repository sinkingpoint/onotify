import { trace } from "@opentelemetry/api";
import { Template } from "@sinkingpoint/gotemplate";
import { internalAlertToAlertmanager } from "endpoints/utils/api";
import { Notifier } from "integrations/types";
import { PagerdutyConfig } from "types/alertmanager";
import { AlertState, CachedAlert } from "types/internal";
import { runInSpan } from "utils/observability";
import { AlertTemplateData, executeTextString, getAlertData } from "utils/template";

const maxEventSize = 512000;
const maxV1DescriptionLenRunes = 1024;
const maxV2SummaryLenRunes = 1024;

interface PagerdutyLink {
	href: string;
	text: string;
}

interface PagerdutyImage {
	src: string;
	alt: string;
	href: string;
}

interface PagerdutyPayload {
	summary: string;
	source: string;
	severity: string;
	timestamp?: string;
	class?: string;
	component?: string;
	group?: string;
	custom_detils?: Record<string, string>;
}

interface PagerdutyMessage {
	routing_key?: string;
	service_key?: string;
	dedup_key?: string;
	incitend_key?: string;
	event_type?: PagerdutyEventType;
	description?: string;
	event_action?: PagerdutyEventType;
	payload: PagerdutyPayload;
	client: string;
	client_url: string;
	details?: Record<string, string>;
	images?: PagerdutyImage[];
	links?: PagerdutyLink[];
}

interface PagerdutyInternal {
	conf: PagerdutyConfig;
	template: Template;
	apiV1?: string;
}

const encodeMessage = (conf: PagerdutyInternal, msg: PagerdutyMessage) => {
	const buffer = JSON.stringify(msg);
	const bufferLength = new TextEncoder().encode(buffer).length;
	if (bufferLength > maxEventSize) {
		const truncatedMsg = `Custom details have been removed because the original event exceeds the maximum size of ${maxEventSize}`;

		if (conf.apiV1) {
			msg.details = { error: truncatedMsg };
		} else {
			msg.payload.custom_detils = { error: truncatedMsg };
		}

		console.log(`Truncated Details because message of size ${bufferLength} exceeds limit ${maxEventSize}`);

		return JSON.stringify(msg);
	}

	return buffer;
};

enum PagerdutyEventType {
	Trigger = "trigger",
	Resolve = "resolve",
}

const notify: Notifier<PagerdutyConfig> = async (
	name: string,
	config: PagerdutyConfig,
	template: Template,
	loadUploadedFile: (filename: string) => Promise<string | null>,
	alerts: CachedAlert[],
	groupLabels: Record<string, string>,
) => {
	return runInSpan(trace.getTracer("Pagerduty Notifier"), "Pagerduty::notify", {}, async () => {
		const externalAlerts = alerts.map((a) => internalAlertToAlertmanager(a));
		const eventType =
			externalAlerts[0].status.state === AlertState.Resolved ? PagerdutyEventType.Resolve : PagerdutyEventType.Trigger;
		const data = getAlertData(name, groupLabels, alerts);
		const details: Record<string, string> = {};
		for (const key of Object.keys(config.details)) {
			try {
				details[key] = executeTextString(template, config.details[key], data);
			} catch (e) {
				throw `Failed to template details entry ${key}: ${config.details[key]}: ${e}`;
			}
		}
	});
};

const notifyV2 = async (
	conf: PagerdutyConfig,
	template: Template,
	loadUploadedFile: (filename: string) => Promise<string | null>,
	eventType: PagerdutyEventType,
	groupKey: string,
	data: AlertTemplateData,
	details: Record<string, string>,
	alerts: CachedAlert[],
) => {
	const span = trace.getActiveSpan();
	if (!conf.severity) {
		conf.severity = "error";
	}

	let summary = executeTextString(template, conf.description, data);
	if (summary.length > maxV2SummaryLenRunes) {
		summary = summary.substring(0, maxV2SummaryLenRunes);
		span?.setAttribute("truncated", true);
	}

	let routingKey = conf.routing_key;
	if (!routingKey) {
		if (!conf.routing_key_file) {
			span?.setAttribute("bailed", true);
			return;
		}

		const loadedRoutingKey = await loadUploadedFile(conf.routing_key_file);
		if (!loadedRoutingKey) {
			span?.setAttribute("baild", true);
			return;
		}

		routingKey = loadedRoutingKey;
	}

	const msg: PagerdutyMessage = {
		client: executeTextString(template, conf.client, data),
		client_url: executeTextString(template, conf.client_url, data),
		routing_key: executeTextString(template, routingKey, data),
		event_action: eventType,
		dedup_key: groupKey,
		images: [],
		links: [],
		payload: {
			summary: summary,
			source: executeTextString(template, conf.source, data),
			severity: executeTextString(template, conf.severity, data),
			custom_detils: details,
			class: executeTextString(template, conf.class ?? "", data),
			component: executeTextString(template, conf.component ?? "", data),
			group: executeTextString(template, conf.group ?? "", data),
		},
	};

	for (const i of conf.images) {
		const image: PagerdutyImage = {
			src: executeTextString(template, i.src ?? "", data),
			alt: executeTextString(template, i.alt ?? "", data),
			href: executeTextString(template, i.href ?? "", data),
		};

		if (image.src) {
			msg.images?.push(image);
		}
	}

	for (const l of conf.links) {
		const link: PagerdutyLink = {
			href: executeTextString(template, l.href ?? "", data),
			text: executeTextString(template, l.text ?? "", data),
		};

		if (link.href) {
			msg.links?.push(link);
		}
	}

	if (!msg.routing_key) {
		span?.recordException("Missing routing key after templating");
	}
};

export default notify;
