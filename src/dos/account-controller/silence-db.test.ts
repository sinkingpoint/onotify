import { fingerprint } from "../../endpoints/utils/fingerprinting";
import { StringMatcherSpec } from "../../types/alertmanager";
import { PostableSilence } from "../../types/api";
import { Alert, Silence } from "../../types/internal";
import { isSilenceSame, SilenceDB } from "./silence-db";

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

class MockStorage<T> {
  vals: Map<string, T>;
  constructor() {
    this.vals = new Map();
  }

  async get(id: string) {
    return this.vals.get(id);
  }

  async put(id: string, s: T) {
    this.vals.set(id, s);
  }

  async delete(id: string) {
    return this.vals.delete(id);
  }
}

class MockSilenceStorage extends MockStorage<Silence> {}

const activeSilence = (...matchers: string[]): PostableSilence => {
  return {
    createdBy: "colin",
    comment: "test-silence",
    startsAt: start,
    endsAt: activeEnd,
    matchers: matchers.map((m) => StringMatcherSpec.parse(m)),
  };
};

test("no silences doesn't silence", async () => {
  const storage = new SilenceDB(new MockSilenceStorage());
  expect(storage.isSilenced(firingAlert({}, {}))).toEqual(false);
});

test("silences match =", async () => {
  const storage = new SilenceDB(new MockSilenceStorage());
  await storage.addSilence(activeSilence('test="true"'));
  expect(storage.isSilenced(firingAlert({ test: "true" }, {}))).toEqual(true);
});

test("silences match !=", async () => {
  const storage = new SilenceDB(new MockSilenceStorage());
  await storage.addSilence(activeSilence('test!="true"'));
  expect(storage.isSilenced(firingAlert({ test: "true2" }, {}))).toEqual(true);
});

test("silences match =~", async () => {
  const storage = new SilenceDB(new MockSilenceStorage());
  await storage.addSilence(activeSilence('test=~"true"'));
  expect(storage.isSilenced(firingAlert({ test: "true" }, {}))).toEqual(true);
});

test("silences don't match unanchored =~", async () => {
  // Regex matchers are assumed to be anchored - start with a ^ and end with a $.
  const storage = new SilenceDB(new MockSilenceStorage());
  await storage.addSilence(activeSilence('test=~"true"'));
  expect(storage.isSilenced(firingAlert({ test: "true-nottrue" }, {}))).toEqual(
    false
  );
});

test("silences doesn't update same", async () => {
  const storage = new SilenceDB(new MockSilenceStorage());
  const [updated, id] = await storage.addSilence(activeSilence('test=~"true"'));
  expect(updated).toEqual(true);

  expect(
    await storage.addSilence({ ...activeSilence('test=~"true"'), id })
  ).toEqual([false, id]);
});

test("is silence same", async () => {
  const storage = new SilenceDB(new MockSilenceStorage());
  const silence = { ...activeSilence('test="true"'), id: "test", updatedAt: 0 };
  expect(isSilenceSame(silence, silence)).toBe(true);
});

test("is silence not same", async () => {
  const storage = new SilenceDB(new MockSilenceStorage());
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
