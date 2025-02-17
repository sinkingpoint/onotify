import { PostableSilence } from "../../types/api";
import { alertState, CachedAlert, GetAlertsOptions, ReceiveredAlert } from "../../types/internal";
import { alertIsSame } from "../../utils/alert";
import { matcherMatches } from "../../utils/matcher";
import { SilenceDB } from "./silence-db";
import { alertKVKey } from "./util";

interface AlertStorage {
	get: (fingerprint: string) => Promise<CachedAlert | undefined>;
	put: (fingerprint: string, alert: CachedAlert) => Promise<void>;
	delete: (fingerprint: string) => Promise<boolean>;
}

export class AlertDB {
	alerts: Map<string, CachedAlert>;
	storage: AlertStorage;
	silenceDB: SilenceDB;
	constructor(storage: AlertStorage, silenceDB: SilenceDB) {
		this.storage = storage;
		this.silenceDB = silenceDB;
		this.alerts = new Map();
	}

	init(alerts: Map<string, CachedAlert>) {
		this.alerts = alerts;
	}

	private async addEvent(existing: CachedAlert, next: ReceiveredAlert) {
		const timestamp = Date.now();
		const newState = alertState(next);
		if (existing.history.length === 0) {
			existing.history.push({
				timestamp,
				ty: newState,
			});
		} else {
			const currentState = existing.history[existing.history.length - 1].ty;
			if (currentState !== newState) {
				existing.history.push({
					timestamp,
					ty: newState,
				});
			}
		}
	}

	async addAlert(a: ReceiveredAlert) {
		const cached = this.alerts.get(a.fingerprint);
		if (cached && alertIsSame(a, cached)) {
			return;
		}

		const silencedBy = cached ? cached.silencedBy : this.silenceDB.silencedBy(a);
		const inhibitedBy = cached ? cached.inhibitedBy : [];
		const history = cached
			? cached.history
			: [
					{
						timestamp: Date.now(),
						ty: alertState(a),
					},
			  ];

		return this.storeAlert({
			silencedBy,
			inhibitedBy,
			updatedAt: Date.now(),
			history,
			...a,
		});
	}

	async getAlert(fingerprint: string): Promise<CachedAlert | undefined> {
		const cached = this.alerts.get(fingerprint);
		if (cached) {
			return cached;
		}

		const loaded = await this.storage.get(alertKVKey(fingerprint));
		if (loaded) {
			this.alerts.set(fingerprint, loaded);
		}

		return loaded;
	}

	async getAlerts({
		active,
		fingerprints,
		silenced,
		muted,
		inhibited,
		unprocessed,
		receiver,
		filter,
		startTime,
		endTime,
	}: GetAlertsOptions): Promise<CachedAlert[]> {
		silenced ??= true;
		inhibited ??= true;
		active ??= true;
		muted ??= true;
		unprocessed ??= true;

		// Special case fingerprints. Because we index by fingerprints, we can
		// immediately pull out the requested fingerprints, saving us iterating the whole space.
		let spectrum;
		if (fingerprints) {
			spectrum = [];
			for (const finger of fingerprints) {
				const alert = await this.getAlert(finger);
				if (alert) {
					spectrum.push(alert);
				}
			}
		} else {
			spectrum = [...this.alerts.values()];
		}

		return spectrum.filter((f) => {
			if (receiver) {
				if (!f.receivers.some((r) => receiver.test(r))) {
					return false;
				}
			}

			if (filter) {
				for (const matcher of filter) {
					if (!matcherMatches(matcher, f.labels)) {
						return false;
					}
				}
			}

			const isSilenced = f.silencedBy.length > 0;
			const isInhibited = f.inhibitedBy.length > 0;
			const isActive = !isSilenced && !isInhibited;
			// TODO(https://github.com/sinkingpoint/onotify/issues/3): Support muted + unprocessed alerts here.

			if (!silenced && isSilenced) {
				return false;
			}

			if (!inhibited && isInhibited) {
				return false;
			}

			if (!active && isActive) {
				return false;
			}

			if (startTime && f.startsAt < startTime) {
				return false;
			}

			if (endTime && f.startsAt > endTime) {
				return false;
			}

			return true;
		});
	}

	async addSilence(id: string, s: PostableSilence) {
		const now = Date.now();
		if (s.startsAt > now || s.endsAt < now) {
			// The silence isn't active. Bail.
			return;
		}

		const promises = [];
		outer: for (const alert of this.alerts.values()) {
			for (const matcher of s.matchers) {
				if (!matcherMatches(matcher, alert.labels)) {
					continue outer;
				}
			}

			if (!alert.silencedBy.includes(id)) {
				alert.silencedBy.push(id);
				promises.push(this.storeAlert(alert));
			}
		}

		return Promise.all(promises);
	}

	private async storeAlert(a: CachedAlert) {
		await this.storage.put(a.fingerprint, a);
		this.alerts.set(a.fingerprint, a);
	}

	// notifySilenceExpired gets called whenever a silence
	async markSilenceExpired(silenceID: string) {
		for (const alert of this.alerts.values()) {
			const idx = alert.silencedBy.indexOf(silenceID);
			if (idx === -1) {
				continue;
			}

			alert.silencedBy.splice(idx, 1);
			await this.storeAlert(alert);
		}
	}
}
