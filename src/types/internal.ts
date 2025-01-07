import { AccountController, AlertGroupController } from "..";
import { Matcher, PostableSilence } from "./api";

interface EnvVars {
	WORKERS_ENV?: string;
}

export interface Bindings extends EnvVars {
	DB: D1Database;
	CONFIGS: KVNamespace;
	ALERT_GROUP_CONTROLLER: DurableObjectNamespace<AlertGroupController>;
	ACCOUNT_CONTROLLER: DurableObjectNamespace<AccountController>;
	ALERT_DISPATCH: Workflow;
}

export interface Alert {
	fingerprint: string;
	startsAt: number;
	endsAt?: number;
	labels: Record<string, string>;
	annotations: Record<string, string>;
}

export enum AlertState {
	Firing = "firing",
	Resolved = "resolved",
}

export const alertState = (a: Alert) => alertStateAt(a, Date.now());

export const alertStateAt = (a: Alert, time: number): AlertState => {
	if (a.endsAt && a.endsAt > 0 && a.endsAt < time) {
		return AlertState.Resolved;
	}

	return AlertState.Firing;
};

export interface DehydratedAlert {
	fingerprint: string;
	state: AlertState;
}

export interface AlertGroup {
	nodeID: string;
	receiver: string;
	labelNames: string[];
	labelValues: string[];
	alerts: DehydratedAlert[];
}

export type Silence = PostableSilence & {
	id: string;
	updatedAt: number;
};

export type AlertEvent = {
	ty: AlertState;
	timestamp: number;
};

export type CachedAlert = Alert & {
	silencedBy: string[];
	inhibitedBy: string[];
	updatedAt: number;
	receivers: string[];
	history: AlertEvent[];
};

export type ReceiveredAlert = Alert & { receivers: string[] };

export interface GetAlertsOptions {
	fingerprints?: string[];
	active?: boolean;
	silenced?: boolean;
	inhibited?: boolean;
	muted?: boolean;
	unprocessed?: boolean;
	receiver?: RegExp;
	filter?: Matcher[];
}
