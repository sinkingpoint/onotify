import { DurableObject } from "cloudflare:workers";
import { GetAlertGroupsOptions, PostableSilence } from "../../types/api";
import { AlertGroup, Bindings, GetAlertsOptions, GetSilencesOptions, ReceiveredAlert } from "../../types/internal";
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

const ACCOUNT_ID_KEY = "account-id";

export class AccountController extends DurableObject<Bindings> {
	silenceStorage: SilenceDB;
	alertStorage: AlertDB;
	alertGroupStorage: AlertGroupDB;

	constructor(state: DurableObjectState, env: Bindings) {
		super(state, env);

		this.silenceStorage = new SilenceDB(new PrefixStorage(state.storage, SILENCE_KV_PREFIX));
		this.alertStorage = new AlertDB(new PrefixStorage(state.storage, ALERT_KV_PREFIX), this.silenceStorage);
		this.alertGroupStorage = new AlertGroupDB(new PrefixStorage(state.storage, ALERT_GROUP_KV_PREFIX));

		state.blockConcurrencyWhile(async () => {
			const silences = await getAllSilences(state.storage);
			this.silenceStorage.init(silences);

			const alerts = await getAllAlerts(state.storage);
			this.alertStorage.init(alerts);

			const alertGroups = await getAllAlertGroups(state.storage);
			this.alertGroupStorage.init(alertGroups);
		});
	}

	async addAlerts(a: ReceiveredAlert[]) {
		a.forEach(async (a) => {
			await this.alertStorage.addAlert(a);
		});
	}

	async getAlert(fingerprint: string) {
		return this.alertStorage.getAlert(fingerprint);
	}

	async getAlerts(options: GetAlertsOptions) {
		return this.alertStorage.getAlerts(options);
	}

	async getSilence(id: string) {
		const silences = await this.silenceStorage.getSilences({ id: [id], active: true, expired: true });
		if (silences.length === 0) {
			return null;
		}

		return silences[0];
	}

	async getSilences(opts: GetSilencesOptions) {
		return this.silenceStorage.getSilences(opts);
	}

	async addSilence(silence: PostableSilence) {
		const [updated, id] = await this.silenceStorage.addSilence(silence);
		if (updated) {
			await this.alertStorage.addSilence(id, silence);
		}

		if (silence.endsAt) {
			const silenceControllerName = `silence-${id}`;
			const silenceControllerID = this.env.SILENCE_CONTROLLER.idFromName(silenceControllerName);
			const silenceController = this.env.SILENCE_CONTROLLER.get(silenceControllerID);
			await silenceController.initialize(this.ctx.id, id, silence.startsAt, silence.endsAt);
		}

		return id;
	}

	async addAlertGroups(groups: AlertGroup[]) {
		for (const group of groups) {
			this.alertGroupStorage.mergeAlertGroup(group);
		}
	}

	async getAlertGroups({ active, silenced, inhibited, muted, filter, receiver }: GetAlertGroupsOptions) {
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
	}

	async markSilenceStarted(id: string) {
		const silence = await this.silenceStorage.getSilences({ id: [id], active: true, expired: true });
		await this.alertStorage.addSilence(id, silence[0]);
	}

	async markSilenceExpired(id: string) {
		await this.alertStorage.markSilenceExpired(id);
	}
}
