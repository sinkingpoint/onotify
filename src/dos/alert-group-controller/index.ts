import { instrumentDO } from "@microlabs/otel-cf-workers";
import { trace } from "@opentelemetry/api";
import { FlatRouteConfig } from "../../types/alertmanager";
import { AlertGroup, Bindings } from "../../types/internal";
import { OTelConfFn, runInSpan, runInSyncSpan } from "../../utils/observability";
import { rpcFetch } from "../../utils/rpc";
import { AlertStateMachine } from "./state-machine";
import { ACCOUNT_ID_KEY, ALERTS_PREFIX, GroupedAlert, LABELS_KV_KEY, PAGE_SIZE, ROUTE_KV_KEY } from "./util";

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
}

const getTracer = () => {
	return trace.getTracer("AlertGroupController");
};

class AlertGroupControllerDO implements DurableObject {
	route: FlatRouteConfig | undefined;
	labels: string[] | undefined;
	state_machine: AlertStateMachine;
	account_id: string;
	state: DurableObjectState;
	env: Bindings;
	constructor(state: DurableObjectState, env: Bindings) {
		this.state = state;
		this.env = env;
		this.state_machine = new AlertStateMachine(this.state.storage);
		this.account_id = "";

		runInSyncSpan(getTracer(), "AlertGroupController::constructor", {}, () => {
			state.blockConcurrencyWhile(async () => {
				this.account_id = (await this.state.storage.get(ACCOUNT_ID_KEY)) ?? "";
				this.labels = await this.state.storage.get(LABELS_KV_KEY);
				this.route = await this.state.storage.get(ROUTE_KV_KEY);
				const [pending_alerts, active_alerts] = await getAlertFingerprints(this.state.storage);
				this.state_machine.initialise(pending_alerts, active_alerts);
			});
		});
	}

	async initialize({ account_id, route, group }: { account_id: string; route: FlatRouteConfig; group: AlertGroup }) {
		return runInSpan(getTracer(), "AlertGroupController::initialize", {}, async () => {
			this.account_id = account_id;
			this.labels = this.labels ?? group.labelValues;
			this.route = route;

			const equalLabels = arraysEqual(this.labels, group.labelValues);
			if (!equalLabels) {
				throw `Expected the given labels (${group.labelValues}) to be the same as the existing labels (${this.labels})`;
			}

			await this.state.storage.put(LABELS_KV_KEY, this.labels);
			await this.state.storage.put(ROUTE_KV_KEY, this.route);
			await this.state.storage.put(ACCOUNT_ID_KEY, this.account_id);
			await Promise.all(group.alerts.map((a) => this.state_machine.handlePendingAlert(a)));

			if (!(await this.state.storage.getAlarm())) {
				// We have never sent a notification for this group, so wait `group_wait`.
				await this.state.storage.setAlarm(Date.now() + this.route.group_wait);
			}
		});
	}

	async alarm() {
		const page_size = PAGE_SIZE > 0 ? PAGE_SIZE : undefined;
		while (this.state_machine.hasPendingAlerts()) {
			const alerts = await this.state_machine.flushPendingAlerts(page_size);
			const dispatch = await this.env.ALERT_DISPATCH.create({
				params: {
					accountId: this.account_id,
					alertFingerprints: alerts.map((a) => a.fingerprint),
					receiverName: this.route?.receiver,
					groupLabels: this.labels,
				},
			});

			console.log("dispatching");
		}

		if (this.state_machine.hasActiveAlerts()) {
			// We have active alerts, so send the next alerts after `group_interval`.
			await this.state.storage.setAlarm(Date.now() + this.route!.group_interval);
		} else {
			// All the alerts have been dispatched. Delete this group.
			await this.state.storage.deleteAll();
		}
	}

	fetch(request: Request) {
		const rpcMethods = {
			[AlertGroupControllerActions.Initialize]: this.initialize,
		};

		return rpcFetch(this, request, rpcMethods);
	}
}

const arraysEqual = (a: string[], b: string[]): boolean => {
	return a.length === b.length && a.every((n, i) => b[i] === n);
};

const AlertController = instrumentDO(AlertGroupControllerDO, OTelConfFn);

export default AlertController;
