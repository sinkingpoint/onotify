import { trace } from "@opentelemetry/api";
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

const getTracer = () => {
	return trace.getTracer("AccountController AlertDB");
};

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

	async addAlert(a: ReceiveredAlert) {
		return getTracer().startActiveSpan("AlertDB::addAlert", {}, (span) => {
			const cached = this.alerts.get(a.fingerprint);
			if (cached && alertIsSame(a, cached)) {
				span.setAttribute("updated", false);
				return;
			}

			span.setAttributes({ updated: true, exists: !!cached });

			const silencedBy = cached ? cached.silencedBy : this.silenceDB.silencedBy(a);
			const inhibitedBy = cached ? cached.inhibitedBy : [];
			const history = cached ? (cached.history ?? []) : [];
			const newState = alertState(a);
			if (history.length === 0) {
				history.push({
					timestamp: Date.now(),
					ty: newState,
				});
			} else if (newState != history[history.length - 1].ty) {
				span.setAttribute("new state", newState);
				history.push({
					timestamp: Date.now(),
					ty: newState,
				});
			}

			span.end();

			return this.storeAlert({
				silencedBy,
				inhibitedBy,
				updatedAt: Date.now(),
				history,
				...a,
			});
		});
	}

	async getAlert(fingerprint: string): Promise<CachedAlert | undefined> {
		return await getTracer().startActiveSpan("AlertDB::getAlert", { attributes: { fingerprint } }, async (span) => {
			const cached = this.alerts.get(fingerprint);
			if (cached) {
				span.setAttribute("cached", true);
				span.end();
				return cached;
			}
			span.setAttribute("cached", false);

			const loaded = await this.storage.get(alertKVKey(fingerprint));
			if (loaded) {
				this.alerts.set(fingerprint, loaded);
			}
			span.setAttribute("exists", !!loaded);
			span.end();

			return loaded;
		});
	}

	async getAlerts({
		active,
		fingerprints,
		silenced,
		muted,
		resolved,
		inhibited,
		unprocessed,
		receiver,
		filter,
		startTime,
		endTime,
	}: GetAlertsOptions): Promise<CachedAlert[]> {
		return getTracer().startActiveSpan(
			"getAlerts",
			{
				attributes: {
					active,
					fingerprints,
					silenced,
					muted,
					resolved,
					inhibited,
					unprocessed,
					receiver: receiver?.toString(),
					startTime,
					endTime,
				},
			},
			async (span) => {
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

				span.setAttribute("spectrum.size", spectrum.length);

				const result = spectrum.filter((f) => {
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
					const isResolved = f.endsAt && f.endsAt < Date.now();
					const isMuted = false;
					const isActive = !isSilenced && !isInhibited && !isResolved && !isMuted;
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

					if (!muted && isMuted) {
						return false;
					}

					if (!resolved && isResolved) {
						return false;
					}

					return true;
				});
				span.setAttribute("result.size", result.length);
				span.end();
				return result;
			},
		);
	}

	async addSilence(id: string, s: PostableSilence) {
		return getTracer().startActiveSpan("AlertDB::addSilence", { attributes: { id } }, async (span) => {
			const now = Date.now();
			if (s.startsAt > now || s.endsAt < now) {
				// The silence isn't active, so there's no need to add it to any alerts as it can't silence anything.
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

			span.setAttribute("affected alerts", promises.length);
			await Promise.all(promises);
			span.end();
		});
	}

	// Just store the alert in the DB
	private async storeAlert(a: CachedAlert) {
		return getTracer().startActiveSpan(
			"AlertDB::storeAlert",
			{ attributes: { fingerprint: a.fingerprint } },
			async (span) => {
				await this.storage.put(a.fingerprint, a);
				this.alerts.set(a.fingerprint, a);
				span.end();
			},
		);
	}

	// notifySilenceExpired gets called whenever a silence expires, to remove it from the `silencedBy` list of all the alerts.
	async markSilenceExpired(silenceID: string) {
		return getTracer().startActiveSpan(
			"AlertDB::markSilenceExpired",
			{ attributes: { id: silenceID } },
			async (span) => {
				const promises = [];
				for (const alert of this.alerts.values()) {
					const idx = alert.silencedBy.indexOf(silenceID);
					if (idx === -1) {
						continue;
					}

					alert.silencedBy.splice(idx, 1);
					promises.push(this.storeAlert(alert));
				}
				await Promise.all(promises);
				span.end();
			},
		);
	}
}
