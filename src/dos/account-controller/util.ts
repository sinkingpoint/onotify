import { Alert, Silence } from "../../types/internal";

export type CachedAlert = Alert & {
  silencedBy: string[];
  inhibitedBy: string[];
};

export const ALERT_KV_PREFIX = "alert";
export const SILENCE_KV_PREFIX = "silence";

export const silenceKVKey = (id: string) => {
  return `${SILENCE_KV_PREFIX}-${id}`;
};

export const alertKVKey = (fingerprint: string) => {
  return `${ALERT_KV_PREFIX}-${fingerprint}`;
};

export const getAllSilences = (
  store: DurableObjectStorage
): Promise<Map<string, Silence>> => {
  return store.list({ prefix: `${SILENCE_KV_PREFIX}-` });
};

export const getAllAlerts = (
  store: DurableObjectStorage
): Promise<Map<string, CachedAlert>> => {
  return store.list({ prefix: `${ALERT_KV_PREFIX}-` });
};
