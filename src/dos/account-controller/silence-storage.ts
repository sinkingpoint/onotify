import { PostableSilence } from "../../types/api";
import { Alert, Silence } from "../../types/internal";
import { matcherIsSame, matcherMatches } from "../../utils/matcher";
const REGEX_CACHE = {};

// Return true if the given silence matches the given alert.
const silenceMatches = (s: Silence, a: Alert) => {
  if (s.endsAt < Date.now() || s.startsAt > Date.now()) {
    return false;
  }

  return s.matchers.every((m) => matcherMatches(m, a, REGEX_CACHE));
};

export const newSilenceID = () => {
  return crypto.randomUUID();
};

export class SilenceStorage {
  silences: Map<string, Silence>;
  constructor() {
    this.silences = new Map();
  }

  // Adds the given silence to the storage, returning true if the value changed,
  // and the ID of the silence.
  addSilence(s: PostableSilence): [boolean, string] {
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

    this.silences.set(newSilence.id, newSilence);
    return [true, newSilence.id];
  }

  isSilenced(a: Alert) {
    return [...this.silences.values()].some((s) => silenceMatches(s, a));
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
