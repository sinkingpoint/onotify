import { Template } from "@sinkingpoint/gotemplate";
import { uploadedFilesKey } from "endpoints/utils/kv";
import { minimatch } from "minimatch";
import { runInSpan } from "./observability";
import { trace } from "@opentelemetry/api";
import { Alert, alertState, CachedAlert } from "types/internal";
import { GettableAlert } from "types/api";

const DEFAULT_TEMPLATE = `{{ define "__alertmanager" }}Alertmanager{{ end }}
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
			const template = new Template("");
			template.parse(DEFAULT_TEMPLATE);
			const uploadedFilesPrefix = `${uploadedFilesKey(accountID)}-`;
			const uploadedFileNames = (await kvs.list({ prefix: uploadedFilesPrefix })).keys.map((k) =>
				k.name.substring(uploadedFilesPrefix.length),
			);

			const templateFileNames = getTemplateKeys(uploadedFileNames, templateGlobs);
			for (const fileKey of templateFileNames) {
				const file = await kvs.get(uploadedFilesPrefix + fileKey);
				if (!file) {
					throw `Failed to load ${fileKey}`;
				}
				template.parse(file);
			}

			return template;
		},
	);
};

// The data that gets piped into alerts when we template them.
// Note: These are _purposely_ capilitised because they are fed into go templates.
export interface AlertTemplateData {
	Receiver: string;
	Status: string;
	Alerts: any[];
	GroupLabels: Record<string, string>;
	CommonLabels: Record<string, string>;
	CommonAnnotations: Record<string, string>;
	ExternalURL: string;
}

export const getAlertData = (receiver: string, groupLabels: Record<string, string>, alerts: CachedAlert[]) => {
	const data: AlertTemplateData = {
		Receiver: receiver, // TODO: Alertmanager calls regexp.QuoteMeta here. We should probably do the same.
		Status: alertState(alerts[0]),
		Alerts: [],
		GroupLabels: groupLabels,
		CommonLabels: { ...alerts[0].labels },
		CommonAnnotations: { ...alerts[0].annotations },
		ExternalURL: "",
	};

	for (const alert of alerts) {
		data.Alerts.push({
			Status: alertState(alert),
			Labels: alert.labels,
			Annotations: alert.annotations,
			StartsAt: alert.startsAt,
			EndsAt: alert.endsAt,
			// GeneratorURL: alert. TODO
			Fingerprint: alert.fingerprint,
		});
	}

	for (let i = 1; i < alerts.length; i++) {
		if (Object.keys(data.CommonLabels).length === 0 && Object.keys(data.CommonAnnotations).length === 0) {
			break;
		}

		for (const key of Object.keys(data.CommonLabels)) {
			if (alerts[i].labels[key] !== data.CommonLabels[key]) {
				delete data.CommonLabels[key];
			}
		}

		for (const key of Object.keys(data.CommonAnnotations)) {
			if (alerts[i].labels[key] !== data.CommonAnnotations[key]) {
				delete data.CommonAnnotations[key];
			}
		}
	}

	return data;
};

export const executeTextString = (t: Template, s: string, data: any) => {
	if (s === "") {
		return "";
	}

	const template = t.clone().option("missingkey=zero").parse(s);
	return template.execute(data);
};
