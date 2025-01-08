import { AlertGroup, CachedAlert, Silence } from "../../types/internal";

export const ALERT_KV_PREFIX = "alert";
export const SILENCE_KV_PREFIX = "silence";
export const ALERT_GROUP_KV_PREFIX = "alert_group";

export const silenceKVKey = (id: string) => {
	return `${SILENCE_KV_PREFIX}-${id}`;
};

export const alertKVKey = (fingerprint: string) => {
	return `${ALERT_KV_PREFIX}-${fingerprint}`;
};

export const getAllSilences = async (store: DurableObjectStorage): Promise<Map<string, Silence>> => {
	return store
		.list<Silence>({ prefix: `${SILENCE_KV_PREFIX}-` })
		.then((m) => stripPrefixFromMap(`${SILENCE_KV_PREFIX}-`, m));
};

export const getAllAlerts = async (store: DurableObjectStorage): Promise<Map<string, CachedAlert>> => {
	return store
		.list<CachedAlert>({ prefix: `${ALERT_KV_PREFIX}-` })
		.then((m) => stripPrefixFromMap(`${ALERT_KV_PREFIX}-`, m));
};

export const getAllAlertGroups = async (store: DurableObjectStorage): Promise<Map<string, AlertGroup>> => {
	return store
		.list<AlertGroup>({ prefix: `${ALERT_GROUP_KV_PREFIX}-` })
		.then((m) => stripPrefixFromMap(`${ALERT_GROUP_KV_PREFIX}-`, m));
};

// Returns the given map, with the given prefix removed from all the keys.
const stripPrefixFromMap = <T>(prefix: string, m: Map<string, T>): Map<string, T> => {
	const keys = [...m.keys()];
	for (const key of keys) {
		if (!key.startsWith(prefix)) {
			continue;
		}

		const val = m.get(key)!;
		m.delete(key);
		const strippedKey = key.substring(prefix.length + 1);
		m.set(strippedKey, val);
	}

	return m;
};

// A helper class that stores a type in a given storage, with each ID
// being prefixed with a given prefix.
export class PrefixStorage<T> {
	store: DurableObjectStorage;
	prefix: string;
	constructor(store: DurableObjectStorage, prefix: string) {
		this.store = store;
		this.prefix = prefix;
	}

	get(id: string): Promise<T | undefined> {
		return this.store.get(`${this.prefix}-${id}`);
	}

	put(id: string, val: T): Promise<void> {
		return this.store.put(`${this.prefix}-${id}`, val);
	}

	delete(id: string): Promise<boolean> {
		return this.store.delete(`${this.prefix}-${id}`);
	}
}
