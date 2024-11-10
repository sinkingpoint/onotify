import { AlertGroupController } from "..";

export interface Bindings {
  DB: D1Database;
  CONFIGS: KVNamespace;
  ALERT_GROUP_CONTROLLER: DurableObjectNamespace<AlertGroupController>;
}

export interface Alert {
  fingerprint: string;
  startsAt: number;
  endsAt?: number;
  labels: Record<string, string>;
  annotations: Record<string, string>;
}

export enum AlertState {
  Firing,
  Resolved,
}

export const alertState = (a: Alert) => alertStateAt(a, Date.now());

export const alertStateAt = (a: Alert, time: number): AlertState => {
  if (a.endsAt && a.endsAt > 0 && a.endsAt < time) {
    return AlertState.Resolved;
  }

  return AlertState.Firing;
};

export interface AlertGroup {
  labels: string[];
  alerts: Alert[];
}
