import { fingerprint } from "../../endpoints/utils/fingerprinting";
import { AlertState, DehydratedAlert } from "../../types/internal";
import { AlertStateMachine } from "./state-machine";
import { GroupedAlert } from "./util";

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
): DehydratedAlert => {
  return {
    fingerprint: fingerprint(labels).toString(16),
    state: AlertState.Firing,
  };
};

const resolvedAlert = (
  labels: Record<string, string>,
): DehydratedAlert => {
  return {
    fingerprint: fingerprint(labels).toString(16),
    state: AlertState.Resolved
  };
};

test("state machine fires once", async () => {
  const state = newStateMachine();
  const alert = firingAlert({ test: "true" });
  await state.handlePendingAlert(alert);

  const alerts = await state.flushPendingAlerts();
  expect(alerts.length).toEqual(1);
  expect(alerts[0]).toEqual({ ...alert, state: AlertState.Firing });

  // Once it's fired once, it shouldn't fire again.
  await state.handlePendingAlert(alert);
  const secondAlerts = await state.flushPendingAlerts();
  expect(secondAlerts).toEqual([]);
});

test("state machine fires resolve", async () => {
  const state = newStateMachine();
  const alert = firingAlert({ test: "true" });
  const rAlert = resolvedAlert({ test: "true" });
  await state.handlePendingAlert(alert);

  const alerts = await state.flushPendingAlerts();
  expect(alerts.length).toEqual(1);
  expect(alerts[0]).toEqual({ ...alert, state: AlertState.Firing });

  await state.handlePendingAlert(rAlert);

  const secondAlerts = await state.flushPendingAlerts();
  expect(secondAlerts.length).toEqual(1);
  expect(secondAlerts[0]).toEqual({ ...rAlert, state: AlertState.Resolved });
});

test("state machine doesn't fire resolve for non-sent alert", async () => {
  const state = newStateMachine();
  const alert = firingAlert({ test: "true" });
  const rAlert = resolvedAlert({ test: "true" });
  await state.handlePendingAlert(alert);
  await state.handlePendingAlert(rAlert);

  const secondAlerts = await state.flushPendingAlerts();
  expect(secondAlerts).toEqual([]);
});

test("state machine paginates", async () => {
  const state = newStateMachine();
  const alert = firingAlert({ test: "true" });
  const alert2 = firingAlert({ test: "true2" });
  await state.handlePendingAlert(alert);
  await state.handlePendingAlert(alert2);

  expect(await state.flushPendingAlerts(1)).toEqual([
    { ...alert, state: AlertState.Firing },
  ]);
  expect(await state.flushPendingAlerts(1)).toEqual([
    { ...alert2, state: AlertState.Firing },
  ]);
});
