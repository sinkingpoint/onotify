import { Matcher, PostableSilence } from "../../types/api";
import { Alert, Silence } from "../../types/internal";
import { matcherIsSame, matcherMatches } from "../../utils/matcher";
const REGEX_CACHE = {};

export interface GetSilenceOptions {
	id?: string;
	matchers?: Matcher[];
}

// Return true if the given silence matches the given alert.
const silenceMatches = (s: Silence, a: Alert) => {
	if (s.endsAt < Date.now() || s.startsAt > Date.now()) {
		return false;
	}

	return s.matchers.every((m) => matcherMatches(m, a.labels, REGEX_CACHE));
};

export const newSilenceID = () => {
	return crypto.randomUUID();
};

export class SilenceDB {
	silences: Map<string, Silence>;
	storage: SilenceStorage;
	constructor(store: SilenceStorage) {
		this.storage = store;
		this.silences = new Map();
	}

	init(silences: Map<string, Silence>) {
		this.silences = silences;
	}

	// Adds the given silence to the storage, returning true if the value changed,
	// and the ID of the silence.
	async addSilence(s: PostableSilence): Promise<[boolean, string]> {
		if (s.id && !this.silences.has(s.id)) {
			// We are updating a silence, but it doesn't exist. Error.
			throw `unknown silence ID: ${s.id}`;
		}

		const newSilence: Silence = {
			...s,
			id: s.id ?? newSilenceID(),
			updatedAt: Date.now(),
		};

		if (s.id && this.silences.get(s.id)) {
			if (isSilenceSame(this.silences.get(s.id)!, newSilence)) {
				return [false, s.id];
			}
		}

		await this.storage.put(newSilence.id, newSilence);
		this.silences.set(newSilence.id, newSilence);
		return [true, newSilence.id];
	}

	async getSilences({ id, matchers }: GetSilenceOptions) {
		let silences = id ? [this.silences.get(id)] : [...this.silences.values()];
		if (matchers) {
			silences = silences.filter((s) => {
				return matchers.every((m1) => s?.matchers.some((m2) => isMatchersEqual(m1, m2)));
			});
		}

		return silences;
	}

	isSilenced(a: Alert) {
		return [...this.silences.values()].some((s) => silenceMatches(s, a));
	}

	silencedBy(a: Alert) {
		return [...this.silences.values()].filter((s) => silenceMatches(s, a)).map((s) => s.id);
	}
}

// Return true if the given silences are functionally the same.
export const isSilenceSame = (s1: Silence, s2: Silence) => {
	return (
		s1.id === s2.id &&
		s1.startsAt === s2.startsAt &&
		s1.endsAt === s2.endsAt &&
		s1.comment === s2.comment &&
		s1.createdBy === s2.createdBy &&
		s1.matchers.length === s2.matchers.length &&
		s1.matchers.every((m, i) => matcherIsSame(m, s2.matchers[i]))
	);
};

const isMatchersEqual = (m1: Matcher, m2: Matcher) => {
	return m1.isEqual === m2.isEqual && m1.isRegex === m2.isRegex && m1.name === m2.name && m1.value === m2.value;
};

export interface SilenceStorage {
	get: (id: string) => Promise<Silence | undefined>;
	put: (id: string, silence: Silence) => Promise<void>;
	delete: (id: string) => Promise<boolean>;
}
