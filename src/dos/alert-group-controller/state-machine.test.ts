import { AlertState } from "../../types/internal";
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

const newStateMachine = () => {
	return new AlertStateMachine(new MockAlertStorage());
};

test("new alert gets flushed", async () => {
	const stateMachine = newStateMachine();
	await stateMachine.handlePendingAlert({
		fingerprint: "0",
		state: AlertState.Firing,
	});

	const alerts = await stateMachine.flushPendingAlerts();
	expect(alerts.length).toBe(1);
	expect(alerts[0].fingerprint).toBe("0");
	expect(alerts[0].state).toBe(AlertState.Firing);
});

test("new alert gets flushed, and then resolved", async () => {
	const stateMachine = newStateMachine();
	await stateMachine.handlePendingAlert({
		fingerprint: "0",
		state: AlertState.Firing,
	});

	const alerts = await stateMachine.flushPendingAlerts();
	expect(alerts.length).toBe(1);
	expect(alerts[0].fingerprint).toBe("0");
	expect(alerts[0].state).toBe(AlertState.Firing);

	await stateMachine.handlePendingAlert({
		fingerprint: "0",
		state: AlertState.Resolved,
	});

	const resolvedAlerts = await stateMachine.flushPendingAlerts();
	expect(resolvedAlerts.length).toBe(1);
	expect(resolvedAlerts[0].fingerprint).toBe("0");
	expect(resolvedAlerts[0].state).toBe(AlertState.Resolved);
});

test("new resolved alert does not get flushed", async () => {
	const stateMachine = newStateMachine();
	await stateMachine.handlePendingAlert({
		fingerprint: "0",
		state: AlertState.Resolved,
	});

	const alerts = await stateMachine.flushPendingAlerts();
	expect(alerts.length).toBe(0);
});

test("new alert gets flushed, and then resolved, and then re-fired", async () => {
	const stateMachine = newStateMachine();
	await stateMachine.handlePendingAlert({
		fingerprint: "0",
		state: AlertState.Firing,
	});

	const alerts = await stateMachine.flushPendingAlerts();
	expect(alerts.length).toBe(1);
	expect(alerts[0].fingerprint).toBe("0");
	expect(alerts[0].state).toBe(AlertState.Firing);

	await stateMachine.handlePendingAlert({
		fingerprint: "0",
		state: AlertState.Resolved,
	});

	const resolvedAlerts = await stateMachine.flushPendingAlerts();
	expect(resolvedAlerts.length).toBe(1);
	expect(resolvedAlerts[0].fingerprint).toBe("0");
	expect(resolvedAlerts[0].state).toBe(AlertState.Resolved);

	await stateMachine.handlePendingAlert({
		fingerprint: "0",
		state: AlertState.Firing,
	});

	const reFiredAlerts = await stateMachine.flushPendingAlerts();
	expect(reFiredAlerts.length).toBe(1);
	expect(reFiredAlerts[0].fingerprint).toBe("0");
	expect(reFiredAlerts[0].state).toBe(AlertState.Firing);
});
