import { instrumentDO } from "@microlabs/otel-cf-workers";
import { trace } from "@opentelemetry/api";
import { GetAlertGroupsOptions, PostableSilence } from "../../types/api";
import {
	AlertGroup,
	Bindings,
	GetAlertsOptions,
	GetSilencesOptions,
	HydratedAlertGroup,
	ReceiveredAlert,
} from "../../types/internal";
import { OTelConfFn, runInSpan } from "../../utils/observability";
import { callRPC, rpcFetch } from "../../utils/rpc";
import { SilenceControllerActions } from "../silence-controller";
import { AlertDB } from "./alert-db";
import { AlertGroupDB } from "./alert-group-db";
import { SilenceDB } from "./silence-db";
import {
	ALERT_GROUP_KV_PREFIX,
	ALERT_KV_PREFIX,
	getAllAlertGroups,
	getAllAlerts,
	getAllSilences,
	PrefixStorage,
	SILENCE_KV_PREFIX,
} from "./util";

export enum AccountControllerActions {
	AddAlerts = "add-alerts",
	GetAlert = "get-alert",
	GetAlerts = "get-alerts",
	GetSilence = "get-silence",
	GetSilences = "get-silences",
	AddSilence = "add-silence",
	AddAlertGroups = "add-alert-groups",
	GetAlertGroups = "get-alert-groups",
	MarkSilenceStarted = "mark-silence-started",
	MarkSilenceExpired = "mark-silence-expired",
}

const getTracer = () => {
	return trace.getTracer("AccountController");
};

class AccountControllerDO implements DurableObject {
	silenceStorage: SilenceDB;
	alertStorage: AlertDB;
	alertGroupStorage: AlertGroupDB;
	state: DurableObjectState;
	env: Bindings;

	constructor(state: DurableObjectState, env: Bindings) {
		this.env = env;
		this.state = state;
		this.silenceStorage = new SilenceDB(new PrefixStorage(state.storage, SILENCE_KV_PREFIX));
		this.alertStorage = new AlertDB(new PrefixStorage(state.storage, ALERT_KV_PREFIX), this.silenceStorage);
		this.alertGroupStorage = new AlertGroupDB(new PrefixStorage(state.storage, ALERT_GROUP_KV_PREFIX));

		runInSpan(getTracer(), "AccountController constructor", {}, (span) => {
			state.blockConcurrencyWhile(async () => {
				const silences = await getAllSilences(state.storage);
				this.silenceStorage.init(silences);

				const alerts = await getAllAlerts(state.storage);
				this.alertStorage.init(alerts);

				const alertGroups = await getAllAlertGroups(state.storage);
				this.alertGroupStorage.init(alertGroups);
			});
		});
	}
	alarm?(alarmInfo?: AlarmInvocationInfo): void | Promise<void> {
		throw new Error("Method not implemented.");
	}
	webSocketMessage?(ws: WebSocket, message: string | ArrayBuffer): void | Promise<void> {
		throw new Error("Method not implemented.");
	}
	webSocketClose?(ws: WebSocket, code: number, reason: string, wasClean: boolean): void | Promise<void> {
		throw new Error("Method not implemented.");
	}
	webSocketError?(ws: WebSocket, error: unknown): void | Promise<void> {
		throw new Error("Method not implemented.");
	}

	private async addAlerts(alerts: ReceiveredAlert[]) {
		runInSpan(getTracer(), "AccountController::addAlerts", {}, async () => {
			alerts.forEach(async (alert) => {
				await this.alertStorage.addAlert(alert);
			});
		});
	}

	private async getAlert(fingerprint: string) {
		return runInSpan(getTracer(), "AccountController::getAlert", {}, async () => {
			return this.alertStorage.getAlert(fingerprint);
		});
	}

	private async getAlerts(options: GetAlertsOptions) {
		return runInSpan(getTracer(), "AccountController::getAlerts", {}, async () => {
			trace.getActiveSpan()?.setAttributes({
				fingerprints: options.fingerprints,
				active: options.active,
				muted: options.muted,
				silenced: options.silenced,
				inhibited: options.inhibited,
			});

			return this.alertStorage.getAlerts(options);
		});
	}

	private async getSilence(id: string) {
		return runInSpan(getTracer(), "AccountController::getSilence", {}, async () => {
			const silences = await this.silenceStorage.getSilences({ id: [id], active: true, expired: true });
			if (silences.length > 0) {
				return silences[0];
			}

			return undefined;
		});
	}

	private async getSilences(opts: GetSilencesOptions) {
		return runInSpan(getTracer(), "AccountController::getSilences", {}, async () => {
			return this.silenceStorage.getSilences(opts);
		});
	}

	private async addSilence(silence: PostableSilence) {
		return runInSpan(getTracer(), "AccountController::addSilence", {}, async () => {
			const [updated, id] = await this.silenceStorage.addSilence(silence);
			if (updated) {
				await this.alertStorage.addSilence(id, silence);
			}

			if (silence.endsAt) {
				const silenceControllerName = `silence-${id}`;
				const silenceControllerID = this.env.SILENCE_CONTROLLER.idFromName(silenceControllerName);
				const silenceController = this.env.SILENCE_CONTROLLER.get(silenceControllerID);
				await callRPC(silenceController, SilenceControllerActions.Initialize, {
					accountControllerID: this.state.id.toString(),
					silenceID: id,
					startTime: silence.startsAt,
					endTime: silence.endsAt,
				});
			}

			return id;
		});
	}

	private async addAlertGroups(groups: AlertGroup[]) {
		return runInSpan(getTracer(), "AccountController::addAlertGroups", {}, async () => {
			for (const group of groups) {
				this.alertGroupStorage.mergeAlertGroup(group);
			}
		});
	}

	private async getAlertGroups({
		active,
		silenced,
		inhibited,
		muted,
		filter,
		receiver,
	}: GetAlertGroupsOptions): Promise<HydratedAlertGroup[]> {
		return runInSpan(getTracer(), "AccountController::getAlertGroups", {}, async () => {
			const dehydratedGroups = await this.alertGroupStorage.getAlertGroups({
				receiver,
				filter,
			});

			const hydratedGroups = await Promise.all(
				dehydratedGroups.map(async (g) => {
					const alerts = await this.getAlerts({
						fingerprints: g.alerts.map((a) => a.fingerprint),
						active,
						muted,
						silenced,
						inhibited,
					});

					return {
						...g,
						alerts,
					};
				})
			);

			return hydratedGroups.filter((g) => g.alerts.length > 0);
		});
	}

	private async markSilenceStarted(id: string) {
		return runInSpan(getTracer(), "AccountController::markSilenceStarted", {}, async () => {
			const silence = await this.silenceStorage.getSilences({ id: [id], active: true, expired: true });
			await this.alertStorage.addSilence(id, silence[0]);
		});
	}

	private async markSilenceExpired(id: string) {
		return runInSpan(getTracer(), "AccountController::markSilenceExpired", {}, async () => {
			await this.alertStorage.markSilenceExpired(id);
		});
	}

	async fetch(request: Request) {
		const rpcMethods = {
			[AccountControllerActions.AddAlerts]: this.addAlerts,
			[AccountControllerActions.GetAlert]: this.getAlert,
			[AccountControllerActions.GetAlerts]: this.getAlerts,
			[AccountControllerActions.GetSilence]: this.getSilence,
			[AccountControllerActions.GetSilences]: this.getSilences,
			[AccountControllerActions.AddSilence]: this.addSilence,
			[AccountControllerActions.AddAlertGroups]: this.addAlertGroups,
			[AccountControllerActions.GetAlertGroups]: this.getAlertGroups,
			[AccountControllerActions.MarkSilenceStarted]: this.markSilenceStarted,
			[AccountControllerActions.MarkSilenceExpired]: this.markSilenceExpired,
		};

		return rpcFetch(this, request, rpcMethods);
	}
}

const AccountController = instrumentDO(AccountControllerDO, OTelConfFn);

export { AccountController };
