import { AlertGroup, AlertState } from "../../types/internal";
import { AlertGroupDB } from "./alert-group-db";

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

class MockAlertGroupStorage extends MockStorage<AlertGroup> {}

const randomID = () => {
  return Math.floor(Math.pow(2, 64) * Math.random()).toString(16);
};

test("new group is gettable", async () => {
  const storage = new MockAlertGroupStorage();
  const db = new AlertGroupDB(storage);

  const group = {
    nodeID: randomID(),
    labelNames: ["alertname"],
    labelValues: ["foo"],
    receiver: "web.hook",
    alerts: [
      {
        fingerprint: randomID(),
        state: AlertState.Firing,
      },
      {
        fingerprint: randomID(),
        state: AlertState.Resolved,
      },
    ],
  };

  await db.mergeAlertGroup(group);
  const receivedGroup = await db.getAlertGroup(group.nodeID, group.labelValues);
  expect(receivedGroup).toBeDefined();
  expect(receivedGroup?.nodeID).toEqual(group.nodeID);
  expect(receivedGroup?.labelNames).toEqual(group.labelNames);
  expect(receivedGroup?.labelValues).toEqual(group.labelValues);
  expect(receivedGroup?.alerts.length).toEqual(1);
  expect(receivedGroup?.alerts[0]).toBe(group.alerts[0]);
});

test("store expires resolved alerts", async () => {
  const storage = new MockAlertGroupStorage();
  const db = new AlertGroupDB(storage);

  const firstGroup = {
    nodeID: randomID(),
    labelNames: ["alertname"],
    labelValues: ["foo"],
    receiver: "web.hook",
    alerts: [
      {
        fingerprint: randomID(),
        state: AlertState.Firing,
      },
      {
        fingerprint: randomID(),
        state: AlertState.Firing,
      },
    ],
  };

  const secondGroup = {
    nodeID: firstGroup.nodeID,
    labelNames: firstGroup.labelNames,
    labelValues: firstGroup.labelValues,
    receiver: firstGroup.receiver,
    alerts: [
      {
        ...firstGroup.alerts[0],
        state: AlertState.Resolved,
      },
    ],
  };

  await db.mergeAlertGroup(firstGroup);
  await db.mergeAlertGroup(secondGroup);

  const receivedGroup = await db.getAlertGroup(
    firstGroup.nodeID,
    firstGroup.labelValues
  );
  expect(receivedGroup).toBeDefined();
  expect(receivedGroup?.nodeID).toEqual(firstGroup.nodeID);
  expect(receivedGroup?.labelNames).toEqual(firstGroup.labelNames);
  expect(receivedGroup?.labelValues).toEqual(firstGroup.labelValues);
  expect(receivedGroup?.alerts.length).toEqual(1);
  expect(receivedGroup?.alerts[0]).toBe(firstGroup.alerts[1]);
});

test("store deletes empty groups", async () => {
  const storage = new MockAlertGroupStorage();
  const db = new AlertGroupDB(storage);

  const firstGroup = {
    nodeID: randomID(),
    labelNames: ["alertname"],
    labelValues: ["foo"],
    receiver: "web.hook",
    alerts: [
      {
        fingerprint: randomID(),
        state: AlertState.Firing,
      },
    ],
  };

  await db.mergeAlertGroup(firstGroup);

  firstGroup.alerts[0].state = AlertState.Resolved;
  await db.mergeAlertGroup(firstGroup);

  const receivedGroup = await db.getAlertGroup(
    firstGroup.nodeID,
    firstGroup.labelValues
  );
  expect(receivedGroup).toBeUndefined();
});

test("storage adds new alerts", async () => {
  const storage = new MockAlertGroupStorage();
  const db = new AlertGroupDB(storage);

  const firstGroup = {
    nodeID: randomID(),
    labelNames: ["alertname"],
    labelValues: ["foo"],
    receiver: "web.hook",
    alerts: [
      {
        fingerprint: randomID(),
        state: AlertState.Firing,
      },
    ],
  };

  const secondGroup = {
    nodeID: firstGroup.nodeID,
    labelNames: firstGroup.labelNames,
    labelValues: firstGroup.labelValues,
    receiver: firstGroup.receiver,
    alerts: [
      {
        fingerprint: randomID(),
        state: AlertState.Firing,
      },
    ],
  };

  await db.mergeAlertGroup(firstGroup);
  await db.mergeAlertGroup(secondGroup);

  const receivedGroup = await db.getAlertGroup(
    firstGroup.nodeID,
    firstGroup.labelValues
  );
  expect(receivedGroup).toBeDefined();
  expect(receivedGroup?.nodeID).toEqual(firstGroup.nodeID);
  expect(receivedGroup?.labelValues).toEqual(firstGroup.labelValues);
  expect(receivedGroup?.alerts.length).toEqual(2);
  expect(receivedGroup?.alerts[0]).toBe(firstGroup.alerts[0]);
  expect(receivedGroup?.alerts[1]).toBe(secondGroup.alerts[0]);
});
