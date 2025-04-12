import { instrumentDO } from "@microlabs/otel-cf-workers";
import { Span, SpanStatusCode, trace } from "@opentelemetry/api";
import { Template } from "@sinkingpoint/gotemplate";
import { loadJSONKVKey, receiversKVKey, templatePathsKVKey, uploadedFilesKey } from "endpoints/utils/kv";
import { Notifier } from "integrations/types";
import { Receiver } from "types/alertmanager";
import { AlertState, alertState, Bindings, CachedAlert } from "types/internal";
import { OTelConfFn, runInSpan } from "utils/observability";
import { callRPC, rpcFetch } from "utils/rpc";
import { loadTemplateFromAccount } from "utils/template";
import PagerdutyIntegration from "../../integrations/pagerduty";
import WebhookIntegration from "../../integrations/webhook";
import { AlertGroupControllerActions } from "../alert-group-controller";

export enum ReceiverControllerActions {
	Initialise = "initialise",
}

export interface ReceiverConfigInitialiseOpts {
	accountId: string;
	alertGroupControllerID: string;
	name: string;
	receiverType: string;
	receiverConf: any;
	alerts: CachedAlert[];
	groupLabels: Record<string, string>;
}

const getNotifier = (notifierName: string) => {
	switch (notifierName) {
		case "webhook":
			return WebhookIntegration;
		case "pagerduty":
			return PagerdutyIntegration;
		default:
			return null;
	}
};

const accountIdKey = "accountID";
const nameKey = "name";
const receiverTypeKey = "receiverType";
const receiverConfKey = "receiverConf";
const alertsKey = "alerts";
const groupLabelsKey = "groupLabels";
const hasFiredKey = "hasFired";
const retrierKey = "retrier";
const alertGroupControllerIdKey = "alertGroupControllerID";

const maxRetries = 10;

type NotifierConfig = { send_resolved: boolean };

class Retrier {
	remainingRetries: number;
	delay: number;
	constructor(maxRetries: number, initialDelay: number) {
		this.remainingRetries = maxRetries;
		this.delay = initialDelay;
	}

	retry() {
		this.remainingRetries--;
		if (this.remainingRetries < 0) {
			return null;
		}
		const newDelay = this.delay;
		this.delay *= 2;
		return newDelay;
	}
}

class ReceiverControllerDO implements DurableObject {
	state: DurableObjectState;
	env: Bindings;
	accountID: string;
	name: string;
	receiverType: string;
	receiverConf: NotifierConfig;
	alerts: CachedAlert[];
	groupLabels: Record<string, string>;
	hasFired: boolean;
	retrier?: Retrier;
	alertGroupControllerID: string;

	constructor(state: DurableObjectState, env: Bindings) {
		this.state = state;
		this.env = env;
		this.accountID = "";
		this.name = "";
		this.receiverType = "";
		this.receiverConf = { send_resolved: false };
		this.alerts = [];
		this.groupLabels = {};
		this.hasFired = false;
		this.alertGroupControllerID = "";
		state.blockConcurrencyWhile(async () => {
			this.accountID = (await state.storage.get(accountIdKey)) ?? "";
			this.name = (await state.storage.get(nameKey)) ?? "";
			this.receiverType = (await state.storage.get(receiverTypeKey)) ?? "";
			this.receiverConf = (await state.storage.get(receiverConfKey)) ?? { send_resolved: false };
			this.alerts = (await state.storage.get(alertsKey)) ?? [];
			this.groupLabels = (await state.storage.get(groupLabelsKey)) ?? {};
			this.hasFired = (await state.storage.get(hasFiredKey)) ?? false;
			this.retrier = await state.storage.get(retrierKey);
			this.alertGroupControllerID = (await state.storage.get(alertGroupControllerIdKey)) ?? "";
		});
	}

	private async initialise(opts: ReceiverConfigInitialiseOpts) {
		if (!opts.receiverConf.send_resolved) {
			opts.alerts = opts.alerts.filter((a) => alertState(a) == AlertState.Firing);
			if (opts.alerts.length === 0 && !this.hasFired) {
				await this.delete();
				return false;
			}
		}

		if (!this.retrier) {
			this.retrier = new Retrier(maxRetries, 200);
			await this.state.storage.put(retrierKey, this.retrier);
		}

		await this.state.storage.put(accountIdKey, opts.accountId);
		await this.state.storage.put(nameKey, opts.name);
		await this.state.storage.put(receiverTypeKey, opts.receiverType);
		await this.state.storage.put(receiverConfKey, opts.receiverConf);
		await this.state.storage.put(alertsKey, opts.alerts);
		await this.state.storage.put(groupLabelsKey, opts.groupLabels);
		await this.state.storage.put(alertGroupControllerIdKey, opts.alertGroupControllerID);

		this.accountID = opts.accountId;
		this.name = opts.name;
		this.receiverType = opts.receiverType;
		this.receiverConf = opts.receiverConf;
		this.alerts = opts.alerts;
		this.groupLabels = opts.groupLabels;
		this.alertGroupControllerID = opts.alertGroupControllerID;

		if (!this.hasFired) {
			this.state.waitUntil(this.fire());
		}

		return true;
	}

	private async delete() {
		await this.state.storage.deleteAll();
		await this.state.storage.deleteAlarm();
		const alertGroupController = this.env.ALERT_GROUP_CONTROLLER.get(
			this.env.ALERT_GROUP_CONTROLLER.idFromString(this.alertGroupControllerID),
		);

		await callRPC(alertGroupController, AlertGroupControllerActions.NotifyReceiverDone, {
			receiverID: this.state.id.toString(),
		});
	}

	private async runNotifier<C>(
		span: Span,
		template: Template,
		loadUploadedFile: (filename: string) => Promise<string | null>,
		notifier: Notifier<C>,
	) {
		try {
			await notifier(this.name, this.receiverConf as any, template, loadUploadedFile, this.alerts, this.groupLabels);
		} catch (e: any) {
			span.setStatus({
				code: SpanStatusCode.ERROR,
			});
			span.recordException(e.toString());
			const newDelay = this.retrier?.retry();
			if (!newDelay) {
				// We failed to send the alerts :/
				span.setAttribute("completly_failed", true);
				await this.delete();
				return;
			}

			await this.state.storage.setAlarm(Date.now() + newDelay);
		}
	}

	private async fire() {
		if (!this.hasFired) {
			this.hasFired = true;
			await this.state.storage.put(hasFiredKey, true);
		}

		const notifier = getNotifier(this.receiverType);
		if (!notifier) {
			await this.delete();
			throw `Receiver ${this.receiverType} not found`;
		}

		return runInSpan(trace.getTracer("ReceiverController"), "ReceiverController::fire", {}, async (span) => {
			const receivers = (await loadJSONKVKey(this.env.CONFIGS, receiversKVKey(this.accountID))) as Record<
				string,
				Receiver
			>;
			const receiver = receivers[this.name];
			if (!receiver) {
				await this.delete();
				throw `Failed to load receiver ${receiver} from ${this.accountID}`;
			}

			const templatePaths = (await loadJSONKVKey(this.env.CONFIGS, templatePathsKVKey(this.accountID))) as string[];
			const template = await loadTemplateFromAccount(this.accountID, this.env.CONFIGS, templatePaths);

			const loadUploadedFile = (filename: string) => {
				return this.env.CONFIGS.get(`${uploadedFilesKey(this.accountID)}-${filename}`);
			};

			await this.runNotifier(span, template, loadUploadedFile, notifier as any);
		});
	}

	async alarm() {
		trace.getActiveSpan()?.setAttribute("faas.trigger", "do-alarm");
		trace.getActiveSpan()?.setAttribute("do-name", "ReceiverController");

		await this.fire();
	}

	async fetch(request: Request) {
		const rpcMethods = {
			[ReceiverControllerActions.Initialise]: this.initialise,
		};

		return rpcFetch(this, request, rpcMethods);
	}
}

const ReceiverController = instrumentDO(ReceiverControllerDO, OTelConfFn);

export default ReceiverController;
