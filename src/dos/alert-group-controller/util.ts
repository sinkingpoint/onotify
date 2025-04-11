// Used to control the maximum number of alerts in a given batch to send/receive.

import { Alert, AlertState, DehydratedAlert } from "../../types/internal";

// If set to > 0, we will only ever send that number of alerts.
export const PAGE_SIZE = 0;

export const ALERTS_PREFIX = "alert";
export const LABELS_KV_KEY = "labels";
export const ROUTE_KV_KEY = "route";
export const ACCOUNT_ID_KEY = "account-id";
export const RECEIVER_CONTROLLER_KEY = "receiverControllerIDs";

export type GroupedAlert = {
	fingerprint: string;
	state: AlertState;
	pending: boolean;
};

// Gets the key used to store the alert with the given fingerprint in storage.
export const alertKVKey = (fingerprint: string): string => {
	return `${ALERTS_PREFIX}-${fingerprint}`;
};

// Gets the fingerprint of an alert, given the KV key.
export const extractFingerprint = (kvKey: string): string => {
	if (kvKey.startsWith(`${ALERTS_PREFIX}-`)) {
		return kvKey.slice(ALERTS_PREFIX.length + 1);
	}

	return kvKey;
};

export interface AlertStorage {
	get: (fingerprint: string) => Promise<GroupedAlert | undefined>;
	put: (fingerprint: string, alert: GroupedAlert) => Promise<void>;
	delete: (fingerprint: string) => Promise<boolean>;
}
