import { Notifier } from "integrations/types";
import { WebhookConfig } from "../../types/alertmanager";
import { alertState, AlertState, CachedAlert } from "../../types/internal";

const USER_AGENT = "onotify + Alertmanager/0.27.0";

const truncateAlerts = (alertFingerprints: CachedAlert[], n: number): [CachedAlert[], number] => {
	if (n > 0 && alertFingerprints.length > n) {
		return [alertFingerprints.slice(0, n), alertFingerprints.length - n];
	}

	return [alertFingerprints, 0];
};

const getCommon = (r: Record<string, string>[]): Record<string, string> => {
	const common: Record<string, string> = {};
	outer: for (const key of Object.keys(r[0])) {
		const val = r[0][key];
		for (let i = 1; i < r.length; i++) {
			if (r[i][key] != val) {
				continue outer;
			}
		}

		common[key] = val;
	}

	return common;
};

const notify: Notifier<WebhookConfig> = async (
	name: string,
	config: WebhookConfig,
	alerts: CachedAlert[],
	groupLabels: Record<string, string>,
) => {
	const [newAlerts, numTruncated] = truncateAlerts(alerts, config.max_alerts);
	const status = alerts.some((a) => alertState(a) === AlertState.Firing) ? "firing" : "resolved";

	const commonLabels = getCommon(alerts.map((a) => a.labels));
	const commonAnnotations = getCommon(alerts.map((a) => a.annotations));

	const payload: WebhookReceiverPayload = {
		version: "4",
		truncatedAlerts: numTruncated,
		status,
		receiver: name,
		groupLabels,
		commonLabels,
		commonAnnotations,
		externalURL: "",
		groupKey: "",
		alerts: newAlerts.map((a) => {
			const status = alertState(a) === AlertState.Firing ? "firing" : "resolved";
			return {
				...a,
				silencedBy: a.silencedBy.length > 0 ? a.silencedBy : undefined,
				inhibitedBy: a.silencedBy.length > 0 ? a.silencedBy : undefined,
				startsAt: new Date(a.startsAt).toISOString(),
				endsAt: a.endsAt ? new Date(a.endsAt).toISOString() : undefined,
				status,
				generatorURL: `localhost:1234/${a.fingerprint}`,
			};
		}),
	};

	const resp = await fetch(config.url!, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"User-Agent": USER_AGENT,
		},
		body: JSON.stringify(payload),
	});

	console.log(resp);
};

export default notify;

interface WebhookReceiverPayload {
	version: "4";
	groupKey: string;
	truncatedAlerts: number;
	status: "resolved" | "firing";
	receiver: string;
	groupLabels: Record<string, string>;
	commonLabels: Record<string, string>;
	commonAnnotations: Record<string, string>;
	externalURL: string;
	alerts: WebhookReceiverAlertPayload[];
}

interface WebhookReceiverAlertPayload {
	status: "resolved" | "firing";
	labels: Record<string, string>;
	annotations: Record<string, string>;
	startsAt: string;
	endsAt?: string;
	generatorURL: string;
	fingerprint: string;
}
