import { AlertState, DehydratedAlert } from "../../types/internal";
import { alertKVKey, AlertStorage, GroupedAlert } from "./util";

// A StateMachine that handles alerts and whether they should be notified.
export class AlertStateMachine {
	private pending_alert_fingerprints: string[];
	private active_alert_fingerprints: string[];
	private storage: AlertStorage;

	constructor(storage: AlertStorage) {
		this.pending_alert_fingerprints = [];
		this.active_alert_fingerprints = [];
		this.storage = storage;
	}

	initialise(pending_fingerprints: string[], active_fingerprints: string[]) {
		this.pending_alert_fingerprints = pending_fingerprints;
		this.active_alert_fingerprints = active_fingerprints;
	}

	// Gets the first n pending alerts (or, all of them if n doesn't exist),
	// moving any pending and active alerts into the active fingerprints and
	// deleting any pending and resolved alerts after sending the resolved notification.
	async flushPendingAlerts(n?: number): Promise<DehydratedAlert[]> {
		n ??= this.pending_alert_fingerprints.length;

		let fingerprints = this.pending_alert_fingerprints.slice(0, Math.min(n, this.pending_alert_fingerprints.length));

		let alerts: DehydratedAlert[] = await Promise.all(
			fingerprints.map((f) =>
				(async () => {
					const alert = await this.storage.get(alertKVKey(f));
					if (!alert) {
						throw `got ID ${f}, but couldn't load it`;
					}

					return { fingerprint: alert.fingerprint, state: alert.state };
				})()
			)
		);

		const newFingerprints = (
			await Promise.all(
				alerts.map(async (a) => {
					if (a.state === AlertState.Firing) {
						await this.storage.put(alertKVKey(a.fingerprint), { ...a, pending: false });

						return a.fingerprint;
					} else {
						return undefined;
					}
				})
			)
		).filter((f) => f !== undefined);

		this.active_alert_fingerprints.push(...newFingerprints);
		this.pending_alert_fingerprints = this.pending_alert_fingerprints.slice(fingerprints.length);

		return alerts;
	}

	// Returns true if there are any alerts that have not yet been notified.
	hasPendingAlerts(): boolean {
		return this.pending_alert_fingerprints.length > 0;
	}

	// Returns true if there are any alerts that have been notified and are still firing.
	hasActiveAlerts(): boolean {
		return this.active_alert_fingerprints.length > 0;
	}

	// Adds this alert to the state machine, moving things around according to the state rules.
	async handlePendingAlert(newAlert: DehydratedAlert) {
		const fingerprint = newAlert.fingerprint;
		const kvKey = alertKVKey(fingerprint);
		const isNowResolved = newAlert.state === AlertState.Resolved;
		const current: GroupedAlert | undefined = await this.storage.get(kvKey);
		if (!current) {
			if (!isNowResolved) {
				await this.storage.put(kvKey, { ...newAlert, pending: true });
				// We currently don't have the alert, so just add it.
				this.pending_alert_fingerprints.push(fingerprint);
			}

			return;
		}

		const wasResolved = current.state === AlertState.Resolved;

		if (isNowResolved) {
			// If the alert is now resolved, remove it from the pending list if it's there, or
			// move it into pending if it isn't.
			const pendingIndex = this.pending_alert_fingerprints.indexOf(fingerprint);
			if (pendingIndex !== -1) {
				if (!wasResolved) {
					// The alert hasn't fired yet, so just remove it.
					await this.storage.delete(kvKey);
					this.pending_alert_fingerprints = this.pending_alert_fingerprints.filter((f) => f != fingerprint);
				}
			} else if (!wasResolved && isNowResolved) {
				// The alert has fired, move it back to pending to send a resolved notification.
				await this.storage.put(kvKey, { ...newAlert, pending: true });
				this.pending_alert_fingerprints.push(fingerprint);
				this.active_alert_fingerprints = this.active_alert_fingerprints.filter((f) => f !== fingerprint);
			}
		} else {
			// The alert is just outdated, update it.
			await this.storage.put(kvKey, {
				...newAlert,
				state: current.state,
				pending: current.pending,
			});
		}
	}
}
