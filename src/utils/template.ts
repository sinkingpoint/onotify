import { trace } from "@opentelemetry/api";
import { Template } from "@sinkingpoint/gotemplate";
import { minimatch } from "minimatch";
import { uploadedFilesKey } from "../endpoints/utils/kv";
import { AlertState, alertState, CachedAlert } from "../types/internal";
import { runInSpan } from "./observability";

export const DEFAULT_TEMPLATE = `{{ define "__alertmanager" }}Alertmanager{{ end }}
{{ define "__alertmanagerURL" }}{{ .ExternalURL }}/#/alerts?receiver={{ .Receiver | urlquery }}{{ end }}

{{ define "__subject" }}[{{ .Status | toUpper }}{{ if eq .Status "firing" }}:{{ .Alerts.Firing | len }}{{ end }}] {{ .GroupLabels.SortedPairs.Values | join " " }} {{ if gt (len .CommonLabels) (len .GroupLabels) }}({{ with .CommonLabels.Remove .GroupLabels.Names }}{{ .Values | join " " }}{{ end }}){{ end }}{{ end }}
{{ define "__description" }}{{ end }}

{{ define "__text_alert_list" }}{{ range . }}Labels:
{{ range .Labels.SortedPairs }} - {{ .Name }} = {{ .Value }}
{{ end }}Annotations:
{{ range .Annotations.SortedPairs }} - {{ .Name }} = {{ .Value }}
{{ end }}Source: {{ .GeneratorURL }}
{{ end }}{{ end }}

{{ define "__text_alert_list_markdown" }}{{ range . }}
Labels:
{{ range .Labels.SortedPairs }}  - {{ .Name }} = {{ .Value }}
{{ end }}
Annotations:
{{ range .Annotations.SortedPairs }}  - {{ .Name }} = {{ .Value }}
{{ end }}
Source: {{ .GeneratorURL }}
{{ end }}
{{ end }}

{{ define "slack.default.title" }}{{ template "__subject" . }}{{ end }}
{{ define "slack.default.username" }}{{ template "__alertmanager" . }}{{ end }}
{{ define "slack.default.fallback" }}{{ template "slack.default.title" . }} | {{ template "slack.default.titlelink" . }}{{ end }}
{{ define "slack.default.callbackid" }}{{ end }}
{{ define "slack.default.pretext" }}{{ end }}
{{ define "slack.default.titlelink" }}{{ template "__alertmanagerURL" . }}{{ end }}
{{ define "slack.default.iconemoji" }}{{ end }}
{{ define "slack.default.iconurl" }}{{ end }}
{{ define "slack.default.text" }}{{ end }}
{{ define "slack.default.footer" }}{{ end }}


{{ define "pagerduty.default.description" }}{{ template "__subject" . }}{{ end }}
{{ define "pagerduty.default.client" }}{{ template "__alertmanager" . }}{{ end }}
{{ define "pagerduty.default.clientURL" }}{{ template "__alertmanagerURL" . }}{{ end }}
{{ define "pagerduty.default.instances" }}{{ template "__text_alert_list" . }}{{ end }}


{{ define "opsgenie.default.message" }}{{ template "__subject" . }}{{ end }}
{{ define "opsgenie.default.description" }}{{ .CommonAnnotations.SortedPairs.Values | join " " }}
{{ if gt (len .Alerts.Firing) 0 -}}
Alerts Firing:
{{ template "__text_alert_list" .Alerts.Firing }}
{{- end }}
{{ if gt (len .Alerts.Resolved) 0 -}}
Alerts Resolved:
{{ template "__text_alert_list" .Alerts.Resolved }}
{{- end }}
{{- end }}
{{ define "opsgenie.default.source" }}{{ template "__alertmanagerURL" . }}{{ end }}


{{ define "wechat.default.message" }}{{ template "__subject" . }}
{{ .CommonAnnotations.SortedPairs.Values | join " " }}
{{ if gt (len .Alerts.Firing) 0 -}}
Alerts Firing:
{{ template "__text_alert_list" .Alerts.Firing }}
{{- end }}
{{ if gt (len .Alerts.Resolved) 0 -}}
Alerts Resolved:
{{ template "__text_alert_list" .Alerts.Resolved }}
{{- end }}
AlertmanagerUrl:
{{ template "__alertmanagerURL" . }}
{{- end }}
{{ define "wechat.default.to_user" }}{{ end }}
{{ define "wechat.default.to_party" }}{{ end }}
{{ define "wechat.default.to_tag" }}{{ end }}
{{ define "wechat.default.agent_id" }}{{ end }}



{{ define "victorops.default.state_message" }}{{ .CommonAnnotations.SortedPairs.Values | join " " }}
{{ if gt (len .Alerts.Firing) 0 -}}
Alerts Firing:
{{ template "__text_alert_list" .Alerts.Firing }}
{{- end }}
{{ if gt (len .Alerts.Resolved) 0 -}}
Alerts Resolved:
{{ template "__text_alert_list" .Alerts.Resolved }}
{{- end }}
{{- end }}
{{ define "victorops.default.entity_display_name" }}{{ template "__subject" . }}{{ end }}
{{ define "victorops.default.monitoring_tool" }}{{ template "__alertmanager" . }}{{ end }}

{{ define "pushover.default.title" }}{{ template "__subject" . }}{{ end }}
{{ define "pushover.default.message" }}{{ .CommonAnnotations.SortedPairs.Values | join " " }}
{{ if gt (len .Alerts.Firing) 0 }}
Alerts Firing:
{{ template "__text_alert_list" .Alerts.Firing }}
{{ end }}
{{ if gt (len .Alerts.Resolved) 0 }}
Alerts Resolved:
{{ template "__text_alert_list" .Alerts.Resolved }}
{{ end }}
{{ end }}
{{ define "pushover.default.url" }}{{ template "__alertmanagerURL" . }}{{ end }}

{{ define "sns.default.subject" }}{{ template "__subject" . }}{{ end }}
{{ define "sns.default.message" }}{{ .CommonAnnotations.SortedPairs.Values | join " " }}
{{ if gt (len .Alerts.Firing) 0 }}
Alerts Firing:
{{ template "__text_alert_list" .Alerts.Firing }}
{{ end }}
{{ if gt (len .Alerts.Resolved) 0 }}
Alerts Resolved:
{{ template "__text_alert_list" .Alerts.Resolved }}
{{ end }}
{{ end }}

{{ define "telegram.default.message" }}
{{ if gt (len .Alerts.Firing) 0 }}
Alerts Firing:
{{ template "__text_alert_list" .Alerts.Firing }}
{{ end }}
{{ if gt (len .Alerts.Resolved) 0 }}
Alerts Resolved:
{{ template "__text_alert_list" .Alerts.Resolved }}
{{ end }}
{{ end }}

{{ define "discord.default.content" }}{{ end }}
{{ define "discord.default.title" }}{{ template "__subject" . }}{{ end }}
{{ define "discord.default.message" }}
{{ if gt (len .Alerts.Firing) 0 }}
Alerts Firing:
{{ template "__text_alert_list" .Alerts.Firing }}
{{ end }}
{{ if gt (len .Alerts.Resolved) 0 }}
Alerts Resolved:
{{ template "__text_alert_list" .Alerts.Resolved }}
{{ end }}
{{ end }}

{{ define "webex.default.message" }}{{ .CommonAnnotations.SortedPairs.Values | join " " }}
{{ if gt (len .Alerts.Firing) 0 }}
Alerts Firing:
{{ template "__text_alert_list" .Alerts.Firing }}
{{ end }}
{{ if gt (len .Alerts.Resolved) 0 }}
Alerts Resolved:
{{ template "__text_alert_list" .Alerts.Resolved }}
{{ end }}
{{ end }}

{{ define "msteams.default.summary" }}{{ template "__subject" . }}{{ end }}
{{ define "msteams.default.title" }}{{ template "__subject" . }}{{ end }}
{{ define "msteams.default.text" }}
{{ if gt (len .Alerts.Firing) 0 }}
# Alerts Firing:
{{ template "__text_alert_list_markdown" .Alerts.Firing }}
{{ end }}
{{ if gt (len .Alerts.Resolved) 0 }}
# Alerts Resolved:
{{ template "__text_alert_list_markdown" .Alerts.Resolved }}
{{ end }}
{{ end }}

{{ define "msteamsv2.default.title" }}{{ template "__subject" . }}{{ end }}
{{ define "msteamsv2.default.text" }}
{{ if gt (len .Alerts.Firing) 0 }}
# Alerts Firing:
{{ template "__text_alert_list_markdown" .Alerts.Firing }}
{{ end }}
{{ if gt (len .Alerts.Resolved) 0 }}
# Alerts Resolved:
{{ template "__text_alert_list_markdown" .Alerts.Resolved }}
{{ end }}
{{ end }}

{{ define "jira.default.summary" }}{{ template "__subject" . }}{{ end }}
{{ define "jira.default.description" }}
{{ if gt (len .Alerts.Firing) 0 }}
# Alerts Firing:
{{ template "__text_alert_list_markdown" .Alerts.Firing }}
{{ end }}
{{ if gt (len .Alerts.Resolved) 0 }}
# Alerts Resolved:
{{ template "__text_alert_list_markdown" .Alerts.Resolved }}
{{ end }}
{{ end }}

{{- define "jira.default.priority" -}}
{{- $priority := "" }}
{{- range .Alerts.Firing -}}
    {{- $severity := index .Labels "severity" -}}
    {{- if (eq $severity "critical") -}}
        {{- $priority = "High" -}}
    {{- else if (and (eq $severity "warning") (ne $priority "High")) -}}
        {{- $priority = "Medium" -}}
    {{- else if (and (eq $severity "info") (eq $priority "")) -}}
        {{- $priority = "Low" -}}
    {{- end -}}
{{- end -}}
{{- if eq $priority "" -}}
    {{- range .Alerts.Resolved -}}
        {{- $severity := index .Labels "severity" -}}
        {{- if (eq $severity "critical") -}}
            {{- $priority = "High" -}}
        {{- else if (and (eq $severity "warning") (ne $priority "High")) -}}
            {{- $priority = "Medium" -}}
        {{- else if (and (eq $severity "info") (eq $priority "")) -}}
            {{- $priority = "Low" -}}
        {{- end -}}
    {{- end -}}
{{- end -}}
{{- $priority -}}
{{- end -}}

{{ define "rocketchat.default.title" }}{{ template "__subject" . }}{{ end }}
{{ define "rocketchat.default.alias" }}{{ template "__alertmanager" . }}{{ end }}
{{ define "rocketchat.default.titlelink" }}{{ template "__alertmanagerURL" . }}{{ end }}
{{ define "rocketchat.default.emoji" }}{{ end }}
{{ define "rocketchat.default.iconurl" }}{{ end }}
{{ define "rocketchat.default.text" }}{{ end }}`;

export const getTemplateKeys = (uploadedFilesNames: string[], templateGlobs: string[]) => {
	return uploadedFilesNames.filter((k) => templateGlobs.some((t) => minimatch(k, t)));
};

export const loadTemplateFromAccount = async (accountID: string, kvs: KVNamespace, templateGlobs: string[]) => {
	return await runInSpan(
		trace.getTracer("utils/template"),
		"loadTemplateFromAccount",
		{ attributes: { accountID } },
		async () => {
			const template = newTemplate();
			template.parse(DEFAULT_TEMPLATE);
			const uploadedFilesPrefix = `${uploadedFilesKey(accountID)}-`;
			const uploadedFileNames = (await kvs.list({ prefix: uploadedFilesPrefix })).keys.map((k) =>
				k.name.substring(uploadedFilesPrefix.length),
			);

			const templateFileNames = getTemplateKeys(uploadedFileNames, templateGlobs);
			for (const fileKey of templateFileNames) {
				const file = await kvs.get(uploadedFilesPrefix + fileKey);
				if (!file) {
					continue;
				}

				try {
					template.parse(file);
				} catch {
					console.error(`Failed to parse template ${fileKey} from account ${accountID}`);
					continue;
				}
			}

			return template;
		},
	);
};

interface AlertData {
	Firing: any[];
	Resolved: any[];
}

type PairData = {
	Name: string;
	Value: string;
}[];

interface SortedPairs extends PairData {
	Names: string[];
	Values: string[];
}

const toSortedPairs = (kvs: Record<string, string>) => {
	const keys = Object.keys(kvs).sort();
	const pairs = [];
	for (const k of keys) {
		pairs.push({ Name: k, Value: kvs[k] });
	}

	Object.assign(pairs, {
		Names: keys,
		Values: keys.map((k) => kvs[k]),
	});

	return pairs as SortedPairs;
};

// The data that gets piped into alerts when we template them.
// Note: These are _purposely_ capilitised because they are fed into go templates.
export interface AlertTemplateData {
	Receiver: string;
	Status: string;
	Alerts: AlertData;
	GroupLabels: {
		SortedPairs: SortedPairs;
	};
	CommonLabels: {
		SortedPairs: SortedPairs;
	};
	CommonAnnotations: {
		SortedPairs: SortedPairs;
	};
	ExternalURL: string;
}

export const getAlertData = (receiver: string, groupLabels: Record<string, string>, alerts: CachedAlert[]) => {
	const data: AlertTemplateData = {
		Receiver: receiver, // TODO: Alertmanager calls regexp.QuoteMeta here. We should probably do the same.
		Status: alertState(alerts[0]),
		Alerts: {
			Firing: [],
			Resolved: [],
		},
		GroupLabels: { SortedPairs: toSortedPairs(groupLabels) },
		CommonLabels: { SortedPairs: [] as unknown as SortedPairs },
		CommonAnnotations: { SortedPairs: [] as unknown as SortedPairs },
		ExternalURL: "",
	};

	for (const alert of alerts) {
		const state = alertState(alert);
		const externalAlert = {
			Status: state,
			StartsAt: alert.startsAt,
			EndsAt: alert.endsAt,
			// GeneratorURL: alert. TODO
			Fingerprint: alert.fingerprint,
			Labels: {
				SortedPairs: toSortedPairs(alert.labels),
			},
			Annotations: {
				SortedPairs: toSortedPairs(alert.annotations),
			},
		};

		if (state === AlertState.Firing) {
			data.Alerts.Firing.push(externalAlert);
		} else {
			data.Alerts.Resolved.push(externalAlert);
		}
	}

	const commonLabels = { ...alerts[0].labels };
	const commonAnnotations = { ...alerts[0].annotations };

	for (let i = 1; i < alerts.length; i++) {
		if (Object.keys(data.CommonLabels).length === 0 && Object.keys(data.CommonAnnotations).length === 0) {
			break;
		}

		for (const key of Object.keys(commonLabels)) {
			if (alerts[i].labels[key] !== commonLabels[key]) {
				delete commonLabels[key];
			}
		}

		for (const key of Object.keys(commonAnnotations)) {
			if (alerts[i].labels[key] !== commonAnnotations[key]) {
				delete commonAnnotations[key];
			}
		}
	}

	data.GroupLabels.SortedPairs = toSortedPairs(groupLabels);
	data.CommonLabels.SortedPairs = toSortedPairs(commonLabels);
	data.CommonAnnotations.SortedPairs = toSortedPairs(commonAnnotations);

	return data;
};

export const executeTextString = (t: Template, s: string, data: any) => {
	if (s === "") {
		return "";
	}

	const template = t.clone().option("missingkey=zero").parse(s);
	return template.execute(data);
};

// formatGoDate takes a date and formats it using fmt as a go date format.
// e.g. "2006-01-02 15:04:05" -> "2023-10-01 12:00:00"
const formatGoDate = (fmt: string, date: number) => {
	// TODO: Properly implement this.
	return new Date(date).toISOString().replace(/T/, " ").replace(/\..+/, "").replace(/-/g, "/");
};

const humanizeDuration = (i: number) => {
	if (isNaN(i) || !isFinite(i)) {
		return i.toFixed(4);
	}

	if (i === 0) {
		return i.toFixed(4) + "s";
	}

	if (Math.abs(i) >= 1) {
		const sign = i < 0 ? "-" : "";
		i = Math.abs(i);
		const duration = Math.floor(i);
		const seconds = duration % 60;
		const minutes = Math.floor((duration / 60) % 60);
		const hours = Math.floor((duration / 60 / 60) % 24);
		const days = Math.floor(duration / 60 / 60 / 24);

		if (days !== 0) {
			return `${sign}${days}d ${hours}h ${minutes}m ${seconds}s`;
		}
		if (hours !== 0) {
			return `${sign}${hours}h ${minutes}m ${seconds}s`;
		}
		if (minutes !== 0) {
			return `${sign}${minutes}m ${seconds}s`;
		}
		return `${sign}${i.toFixed(4)}s`;
	}

	let prefix = "";
	for (const p of ["m", "u", "n", "p", "f", "a", "z", "y"]) {
		if (Math.abs(i) >= 1) {
			break;
		}
		prefix = p;
		i *= 1000;
	}
	return `${i.toFixed(4)}${prefix}s`;
};

// Returns a new template with the default functions and some extra functions.
export const newTemplate = (name?: string) => {
	const template = new Template(name ?? "");
	const extraFuncs: Record<string, Function> = {
		toUpper: (s: string) => s.toUpperCase(),
		toLower: (s: string) => s.toLowerCase(),
		join: (...args: string[]) => args.slice(1).join(args[0]),
		match: (...args: string[]) => {
			const [pattern, str] = args;
			return new RegExp(pattern).test(str);
		},
		safeHTML: (...args: string[]) => args[0].replace(/</g, "&lt;").replace(/>/g, "&gt;"),
		reReplaceAll: (...args: string[]) => {
			const [pattern, replacement, str] = args;
			return str.replace(new RegExp(pattern, "g"), replacement);
		},
		stringSlice: (...args: string[]) => args,
		date: (...args: string[]) => formatGoDate(args[0], parseInt(args[1])),
		tz: (...args: string[]) => {
			return parseInt(args[1]); // TODO: Implement timezone support.
		},
		since: (...args: string[]) => {
			const [start, end] = args;
			return new Date(parseInt(end)).getTime() - new Date(parseInt(start)).getTime();
		},
		humanizeDuration: (...args: string[]) => humanizeDuration(parseInt(args[0])),
	};

	return template.funcs(extraFuncs);
};
