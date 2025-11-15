import { instrumentDO } from "@microlabs/otel-cf-workers";
import { trace } from "@opentelemetry/api";
import { accountControllerName, loadJSONKVKey, receiversKVKey } from "../../endpoints/utils/kv";
import { FlatRouteConfig, Receiver } from "../../types/alertmanager";
import { AlertGroup, Bindings, CachedAlert, DehydratedAlert } from "../../types/internal";
import { OTelConfFn, runInSpan, runInSyncSpan } from "../../utils/observability";
import { callRPC, rpcFetch } from "../../utils/rpc";
import { AccountControllerActions } from "../account-controller";
import { ReceiverConfigInitialiseOpts, ReceiverControllerActions } from "../receiver-controller";
import { AlertStateMachine } from "./state-machine";
import {
	ACCOUNT_ID_KEY,
	ALERTS_PREFIX,
	GroupedAlert,
	LABELS_KV_KEY,
	PAGE_SIZE,
	RECEIVER_CONTROLLER_KEY,
	ROUTE_KV_KEY,
} from "./util";

// Gets the list of alert fingerprints in storage.
const getAlertFingerprints = async (storage: DurableObjectStorage) => {
	return runInSpan(getTracer(), "getAlertFingerprints", {}, async () => {
		const pending_alerts = [];
		const active_alerts = [];
		const options: DurableObjectListOptions = { prefix: ALERTS_PREFIX };
		if (PAGE_SIZE > 0) {
			options.limit = PAGE_SIZE;
		}

		let page = await storage.list<GroupedAlert>(options);
		while (page.size > 0) {
			let pending_fingerprints: string[] = [];
			let active_fingerprints: string[] = [];
			let last;
			for (const [k, v] of page) {
				const fingerprint = k.substring(ALERTS_PREFIX.length + 1);
				if (v.pending) {
					pending_alerts.push(fingerprint);
				} else {
					active_alerts.push(fingerprint);
				}

				last = k;
			}

			pending_alerts.push(...pending_fingerprints);
			active_alerts.push(...active_fingerprints);
			page = await storage.list({
				...options,
				startAfter: last,
			});
		}

		return [pending_alerts, active_alerts];
	});
};

export enum AlertGroupControllerActions {
	Initialize = "initialize",
	NotifyReceiverDone = "notify-receiver-done",
}

interface AlertGroupNotifyReceiverDoneOpts {
	receiverID: string;
	success: boolean;
}

const getTracer = () => {
	return trace.getTracer("AlertGroupController");
};

class AlertGroupControllerDO implements DurableObject {
	route: FlatRouteConfig | undefined;
	labels?: Record<string, string>;
	stateMachine: AlertStateMachine;
	accountID: string;
	state: DurableObjectState;
	env: Bindings;
	receiverControllerIDs: string[];
	constructor(state: DurableObjectState, env: Bindings) {
		this.state = state;
		this.env = env;
		this.stateMachine = new AlertStateMachine(this.state.storage);
		this.accountID = "";
		this.receiverControllerIDs = [];

		runInSyncSpan(getTracer(), "AlertGroupController::constructor", {}, () => {
			state.blockConcurrencyWhile(async () => {
				this.accountID = (await this.state.storage.get(ACCOUNT_ID_KEY)) ?? "";
				this.labels = await this.state.storage.get(LABELS_KV_KEY);
				this.route = await this.state.storage.get(ROUTE_KV_KEY);
				this.receiverControllerIDs = (await this.state.storage.get(RECEIVER_CONTROLLER_KEY)) ?? [];
				const [pending_alerts, active_alerts] = await getAlertFingerprints(this.state.storage);
				this.stateMachine.initialise(pending_alerts, active_alerts);
			});
		});
	}

	private async initialize({
		account_id,
		route,
		group,
	}: {
		account_id: string;
		route: FlatRouteConfig;
		group: AlertGroup;
	}) {
		return runInSpan(getTracer(), "AlertGroupController::initialize", {}, async () => {
			this.accountID = account_id;
			this.route = route;

			if (!this.labels) {
				this.labels = {};
				for (let i = 0; i < group.labelNames.length; i++) {
					const label = group.labelNames[i];
					this.labels[label] = group.labelValues[i];
				}
			}

			if (!sameLabels(this.labels, group.labelNames, group.labelValues)) {
				throw `Expected the given labels (${group.labelValues}) to be the same as the existing labels (${this.labels})`;
			}

			this.state.waitUntil(
				(async () => {
					await this.state.storage.put(LABELS_KV_KEY, this.labels);
					await this.state.storage.put(ROUTE_KV_KEY, this.route);
					await this.state.storage.put(ACCOUNT_ID_KEY, this.accountID);
					await Promise.all(group.alerts.map((a) => this.stateMachine.handlePendingAlert(a)));
					if (!(await this.state.storage.getAlarm())) {
						// We have never sent a notification for this group, so wait `group_wait`.
						await this.state.storage.setAlarm(Date.now() + route.group_wait);
					}
				})(),
			);
		});
	}

	private async fire(alerts: CachedAlert[]) {
		return runInSpan(
			trace.getTracer("AlertGroupController"),
			"fire",
			{
				attributes: {
					"num-alerts": alerts.length,
					receiver: this.route?.receiver,
					accountID: this.accountID,
				},
			},
			async () => {
				if (!this.route?.receiver) {
					return;
				}

				const receivers = (await loadJSONKVKey(this.env.CONFIGS, receiversKVKey(this.accountID))) as Record<
					string,
					Receiver
				>;

				const receiver = receivers[this.route.receiver];
				if (!receiver) {
					throw new Error(`Receiver ${this.route.receiver} not found`);
				}

				const createReceiverControllers = async (receiverType: string, configs: any[]) => {
					for (const conf of configs) {
						const id = this.env.RECEIVER_CONTROLLER.newUniqueId();
						const controller = this.env.RECEIVER_CONTROLLER.get(id);
						const didFire = await callRPC(controller, ReceiverControllerActions.Initialise, {
							accountId: this.accountID,
							name: this.route?.receiver,
							receiverType,
							alerts,
							groupLabels: this.labels,
							receiverConf: conf,
							alertGroupControllerID: this.state.id.toString(),
						} as ReceiverConfigInitialiseOpts);

						if (didFire) {
							this.receiverControllerIDs.push(id.toString());
						}
					}
				};

				try {
					if (receiver.webhook_configs) {
						await createReceiverControllers("webhook", receiver.webhook_configs);
					}

					if (receiver.pagerduty_configs) {
						await createReceiverControllers("pagerduty", receiver.pagerduty_configs);
					}
				} finally {
					await this.state.storage.put(RECEIVER_CONTROLLER_KEY, this.receiverControllerIDs);
				}
			},
		);
	}

	async alarm() {
		trace.getActiveSpan()?.setAttribute("faas.trigger", "do-alarm");
		trace.getActiveSpan()?.setAttribute("do-name", "AlertGroupController");

		if (this.stateMachine.hasPendingAlerts()) {
			trace.getActiveSpan()?.setAttribute("has_pending_alerts", true);
			const page_size = PAGE_SIZE > 0 ? PAGE_SIZE : undefined;
			while (this.stateMachine.hasPendingAlerts()) {
				const alerts = await this.stateMachine.flushPendingAlerts(page_size);
				this.fire(await this.hydrateAlerts(alerts));
			}
		} else {
			// In the fall through case here, we just reschedule the alarm. We could probably do something smarter here
			// to avoid waking up the worker if we know that there are no pending alerts.
			trace.getActiveSpan()?.setAttribute("has_pending_alerts", false);
		}

		if (this.stateMachine.hasActiveAlerts()) {
			// We have active alerts, so send the next alerts after `group_interval`.
			await this.state.storage.setAlarm(Date.now() + this.route!.group_interval);
		} else {
			// All the alerts have been dispatched. Delete this group.
			await this.state.storage.deleteAll();
		}
	}

	private async notifyReceiverDone({ receiverID }: AlertGroupNotifyReceiverDoneOpts) {
		this.receiverControllerIDs = this.receiverControllerIDs.filter((id) => id !== receiverID);
		await this.state.storage.put(RECEIVER_CONTROLLER_KEY, this.receiverControllerIDs);
	}

	private async hydrateAlerts(alerts: DehydratedAlert[]) {
		const fingerprints = alerts.map((a) => a.fingerprint);
		const controllerName = accountControllerName(this.accountID);
		const accountControllerID = this.env.ACCOUNT_CONTROLLER.idFromName(controllerName);
		const accountController = this.env.ACCOUNT_CONTROLLER.get(accountControllerID);

		return await (callRPC(accountController, AccountControllerActions.GetAlerts, {
			fingerprints: fingerprints,
			silenced: false,
			inhibited: false,
			resolved: true,
		}) as Promise<CachedAlert[]>);
	}

	fetch(request: Request) {
		const rpcMethods = {
			[AlertGroupControllerActions.Initialize]: this.initialize,
			[AlertGroupControllerActions.NotifyReceiverDone]: this.notifyReceiverDone,
		};

		return rpcFetch(this, request, rpcMethods);
	}
}

const sameLabels = (a: Record<string, string>, labelNames: string[], labelValues: string[]): boolean => {
	return Object.keys(a).length === labelNames.length && labelNames.every((key, i) => a[key] === labelValues[i]);
};

const AlertController = instrumentDO(AlertGroupControllerDO, OTelConfFn);

export default AlertController;
