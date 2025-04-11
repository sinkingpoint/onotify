import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { Notifier } from "integrations/types";
import { AccountControllerActions } from "../dos/account-controller";
import {
	accountControllerName,
	globalConfigKVKey,
	loadJSONKVKey,
	receiversKVKey,
	templatePathsKVKey,
	uploadedFilesKey,
} from "../endpoints/utils/kv";
import PagerdutyIntegration from "../integrations/pagerduty";
import WebhookIntegration from "../integrations/webhook";
import { GlobalConfig, Receiver } from "../types/alertmanager";
import { AlertState, alertState, Bindings, CachedAlert } from "../types/internal";
import { callRPC } from "../utils/rpc";
import { Template } from "@sinkingpoint/gotemplate";
import { loadTemplateFromAccount } from "utils/template";

type Params = {
	accountId: string;
	alertFingerprints: string[];
	receiverName: string;
	groupLabels: Record<string, string>;
};

const dispatch = async <T extends { send_resolved: boolean }>(
	name: string,
	configs: T[] | undefined,
	alerts: CachedAlert[],
	template: Template,
	groupLabels: Record<string, string>,
	receiver: Notifier<T>,
) => {
	if (!configs) {
		return;
	}

	const promises: Promise<void>[] = [];
	for (const config of configs) {
		let toSendAlerts = alerts;

		if (!config.send_resolved) {
			toSendAlerts = toSendAlerts.filter((a) => alertState(a) === AlertState.Firing);
		}

		if (toSendAlerts.length === 0) {
			continue;
		}

		promises.push(receiver(name, config, template, alerts, groupLabels));
	}

	await Promise.all(promises);
};

export class AlertDispatch extends WorkflowEntrypoint<Bindings, Params> {
	async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
		const { accountId, alertFingerprints, receiverName, groupLabels } = event.payload;
		const controllerName = accountControllerName(accountId);
		const accountControllerID = this.env.ACCOUNT_CONTROLLER.idFromName(controllerName);
		const accountController = this.env.ACCOUNT_CONTROLLER.get(accountControllerID);

		const receivers = (await loadJSONKVKey(this.env.CONFIGS, receiversKVKey(accountId))) as Record<string, Receiver>;
		const receiver = receivers[receiverName];
		if (!receiver) {
			throw `Failed to load receiver ${receiver} from ${accountId}`;
		}

		const templatePaths = (await loadJSONKVKey(this.env.CONFIGS, templatePathsKVKey(accountId))) as string[];
		const template = loadTemplateFromAccount(accountId, this.env.CONFIGS, templatePaths);

		const loadUploadedFile = (filename: string) => {
			return this.env.CONFIGS.get(`${uploadedFilesKey(accountId)}-${filename}`);
		};

		// First, resolve the alerts to a final list of alerts to send.
		const alerts = await step.do(
			"resolve alerts",
			() =>
				callRPC(accountController, AccountControllerActions.GetAlerts, {
					fingerprints: alertFingerprints,
					silenced: false,
					inhibited: false,
				}) as Promise<CachedAlert[]>,
		);

		if (alerts.length === 0) {
			// There are no alerts that aren't silenced or inhibited, bail.
			return;
		}

		await step.do("webhooks", () =>
			dispatch(
				receiver.name,
				receiver.webhook_configs,
				alerts,
				loadUploadedFile,
				template,
				groupLabels,
				WebhookIntegration,
			),
		);

		await step.do("pagerduty", () =>
			dispatch(
				receiver.name,
				receiver.pagerduty_configs,
				alerts,
				loadUploadedFile,
				template,
				groupLabels,
				PagerdutyIntegration,
			),
		);
	}
}
