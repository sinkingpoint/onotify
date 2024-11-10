import { fingerprint } from "../../endpoints/utils/fingerprinting";
import { StringMatcherSpec } from "../../types/alertmanager";
import { PostableSilence } from "../../types/api";
import { Alert } from "../../types/internal";
import { isSilenceSame, SilenceStorage } from "./silence-storage";

const start = Date.now() - 5 * 1000;
const activeEnd = start + 30 * 60 * 1000;
const endedEnd = Date.now() - 1 * 1000;

const alertStart = Date.now() - 3 * 1000;

const firingAlert = (
  labels: Record<string, string>,
  annotations: Record<string, string>
): Alert => {
  return {
    fingerprint: fingerprint(labels).toString(16),
    startsAt: alertStart,
    labels,
    annotations,
  };
};

const activeSilence = (...matchers: string[]): PostableSilence => {
  return {
    createdBy: "colin",
    comment: "test-silence",
    startsAt: start,
    endsAt: activeEnd,
    matchers: matchers.map((m) => StringMatcherSpec.parse(m)),
  };
};

test("no silences doesn't silence", () => {
  const storage = new SilenceStorage();
  expect(storage.isSilenced(firingAlert({}, {}))).toEqual(false);
});

test("silences match =", () => {
  const storage = new SilenceStorage();
  storage.addSilence(activeSilence('test="true"'));
  expect(storage.isSilenced(firingAlert({ test: "true" }, {}))).toEqual(true);
});

test("silences match !=", () => {
  const storage = new SilenceStorage();
  storage.addSilence(activeSilence('test!="true"'));
  expect(storage.isSilenced(firingAlert({ test: "true2" }, {}))).toEqual(true);
});

test("silences match =~", () => {
  const storage = new SilenceStorage();
  storage.addSilence(activeSilence('test=~"true"'));
  expect(storage.isSilenced(firingAlert({ test: "true" }, {}))).toEqual(true);
});

test("silences don't match unanchored =~", () => {
  // Regex matchers are assumed to be anchored - start with a ^ and end with a $.
  const storage = new SilenceStorage();
  storage.addSilence(activeSilence('test=~"true"'));
  expect(storage.isSilenced(firingAlert({ test: "true-nottrue" }, {}))).toEqual(
    false
  );
});

test("silences doesn't update same", () => {
  const storage = new SilenceStorage();
  const [updated, id] = storage.addSilence(activeSilence('test=~"true"'));
  expect(updated).toEqual(true);

  expect(storage.addSilence({ ...activeSilence('test=~"true"'), id })).toEqual([
    false,
    id,
  ]);
});

test("is silence same", () => {
  const storage = new SilenceStorage();
  const silence = { ...activeSilence('test="true"'), id: "test", updatedAt: 0 };
  expect(isSilenceSame(silence, silence)).toBe(true);
});

test("is silence not same", () => {
  const storage = new SilenceStorage();
  const silence1 = {
    ...activeSilence('test="true"'),
    id: "test",
    updatedAt: 0,
  };

  const silence2 = {
    ...activeSilence('test="true2"'),
    id: "test",
    updatedAt: 0,
  };
  expect(isSilenceSame(silence1, silence2)).toBe(false);
});
