import { fingerprint } from "../../endpoints/utils/fingerprinting";
import { Alert } from "../../types/internal";
import { AlertStateMachine } from "./state-machine";

type GroupedAlert = Alert & {
  state: "pending" | "firing" | "resolved";
};

class MockAlertStorage {
  alerts: Map<string, GroupedAlert>;
  constructor() {
    this.alerts = new Map();
  }

  async get(fingerprint: string) {
    return this.alerts.get(fingerprint);
  }

  async put(fingerprint: string, g: GroupedAlert) {
    this.alerts.set(fingerprint, g);
  }

  async delete(fingerprint: string) {
    return this.alerts.delete(fingerprint);
  }
}

const start = Date.now() - 5 * 1000;
const end = Date.now();

const newStateMachine = () => {
  return new AlertStateMachine(new MockAlertStorage());
};

const firingAlert = (
  labels: Record<string, string>,
  annotations: Record<string, string>
): Alert => {
  return {
    fingerprint: fingerprint(labels).toString(16),
    startsAt: start,
    labels,
    annotations,
  };
};

const resolvedAlert = (
  labels: Record<string, string>,
  annotations: Record<string, string>
): Alert => {
  return {
    fingerprint: fingerprint(labels).toString(16),
    startsAt: start,
    endsAt: end,
    labels,
    annotations,
  };
};

test("state machine fires once", async () => {
  const state = newStateMachine();
  const alert = firingAlert({ test: "true" }, {});
  await state.handlePendingAlert(alert);

  const alerts = await state.flushPendingAlerts();
  expect(alerts.length).toEqual(1);
  expect(alerts[0]).toEqual({ ...alert, state: "firing" });

  // Once it's fired once, it shouldn't fire again.
  await state.handlePendingAlert(alert);
  const secondAlerts = await state.flushPendingAlerts();
  expect(secondAlerts).toEqual([]);
});

test("state machine fires resolve", async () => {
  const state = newStateMachine();
  const alert = firingAlert({ test: "true" }, {});
  const rAlert = resolvedAlert({ test: "true" }, {});
  await state.handlePendingAlert(alert);

  const alerts = await state.flushPendingAlerts();
  expect(alerts.length).toEqual(1);
  expect(alerts[0]).toEqual({ ...alert, state: "firing" });

  await state.handlePendingAlert(rAlert);

  const secondAlerts = await state.flushPendingAlerts();
  expect(secondAlerts.length).toEqual(1);
  expect(secondAlerts[0]).toEqual({ ...rAlert, state: "resolved" });
});

test("state machine doesn't fire resolve for non-sent alert", async () => {
  const state = newStateMachine();
  const alert = firingAlert({ test: "true" }, {});
  const rAlert = resolvedAlert({ test: "true" }, {});
  await state.handlePendingAlert(alert);
  await state.handlePendingAlert(rAlert);

  const secondAlerts = await state.flushPendingAlerts();
  expect(secondAlerts).toEqual([]);
});

test("state machine paginates", async () => {
  const state = newStateMachine();
  const alert = firingAlert({ test: "true" }, {});
  const alert2 = firingAlert({ test: "true2" }, {});
  await state.handlePendingAlert(alert);
  await state.handlePendingAlert(alert2);

  expect(await state.flushPendingAlerts(1)).toEqual([
    { ...alert, state: "firing" },
  ]);
  expect(await state.flushPendingAlerts(1)).toEqual([
    { ...alert2, state: "firing" },
  ]);
});
