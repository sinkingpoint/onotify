import { DurableObject } from "cloudflare:workers";
import { Bindings } from "hono/types";
import { SilenceDB } from "./silence-db";
import { getAllAlertGroups, getAllAlerts, getAllSilences } from "./util";
import { AlertDB } from "./alert-db";
import { AlertGroup, GetAlertsOptions, ReceiveredAlert } from "../../types/internal";
import { GetAlertGroupsOptions, Matcher } from "../../types/api";
import { AlertGroupDB } from "./alert-group-db";

export class AccountController extends DurableObject {
	silenceStorage: SilenceDB;
	alertStorage: AlertDB;
	alertGroupStorage: AlertGroupDB;

	constructor(state: DurableObjectState, env: Bindings) {
		super(state, env);

		this.silenceStorage = new SilenceDB(state.storage);
		this.alertStorage = new AlertDB(state.storage, this.silenceStorage);
		this.alertGroupStorage = new AlertGroupDB(state.storage);
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
		return this.silenceStorage.getSilences({ id });
	}

	async getSilences(matchers: Matcher[]) {
		return this.silenceStorage.getSilences({ matchers });
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
			}),
		);

		return hydratedGroups.filter((g) => g.alerts.length > 0);
	}
}
