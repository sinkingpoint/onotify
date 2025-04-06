import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { AccountControllerActions } from "../dos/account-controller";
import { accountControllerName, receiversKVKey } from "../endpoints/utils/kv";
import WebhookIntegration from "../integrations/webhook";
import { Receiver } from "../types/alertmanager";
import { AlertState, alertState, Bindings, CachedAlert } from "../types/internal";
import { callRPC } from "../utils/rpc";

type Params = {
	accountId: string;
	alertFingerprints: string[];
	receiverName: string;
	groupLabels: Record<string, string>;
};

type DispatchFunction<T> = (
	name: string,
	conf: T,
	alerts: CachedAlert[],
	groupLabels: Record<string, string>,
) => Promise<void>;

const dispatch = async <T extends { send_resolved: boolean }>(
	name: string,
	configs: T[] | undefined,
	alerts: CachedAlert[],
	groupLabels: Record<string, string>,
	receiver: DispatchFunction<T>,
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

		promises.push(receiver(name, config, alerts, groupLabels));
	}

	await Promise.all(promises);
};

export class AlertDispatch extends WorkflowEntrypoint<Bindings, Params> {
	async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
		const { accountId, alertFingerprints, receiverName, groupLabels } = event.payload;
		const controllerName = accountControllerName(accountId);
		const accountControllerID = this.env.ACCOUNT_CONTROLLER.idFromName(controllerName);
		const accountController = this.env.ACCOUNT_CONTROLLER.get(accountControllerID);

		const kvKey = receiversKVKey(accountId);
		const rawReceivers = await this.env.CONFIGS.get(kvKey);
		if (!rawReceivers) {
			throw `failed to load receivers from account!`;
		}
		const receivers = JSON.parse(rawReceivers);
		const receiver = receivers[receiverName] as Receiver;

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
			dispatch(receiver.name, receiver.webhook_configs, alerts, groupLabels, WebhookIntegration),
		);
	}
}
