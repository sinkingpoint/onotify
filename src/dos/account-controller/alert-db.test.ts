import { CachedAlert, Silence } from "../../types/internal";
import { AlertDB } from "./alert-db";
import { SilenceDB } from "./silence-db";

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

const randomID = () => {
	return Math.floor(Math.pow(2, 64) * Math.random()).toString(16);
};

test("new alert is gettable", async () => {
	const alertStorage = new MockStorage<CachedAlert>();
	const silenceStorage = new SilenceDB(new MockStorage<Silence>());
	const db = new AlertDB(alertStorage, silenceStorage);

	const alert = {
		fingerprint: randomID(),
		annotations: {},
		labels: {
			test: "foo",
		},
		startsAt: Date.now(),
		endsAt: Date.now() + 10 * 1000,
		receivers: ["noop"],
	};

	await db.addAlert(alert);
	{
		const gotAlert = await db.getAlert(alert.fingerprint);
		expect(gotAlert).toMatchObject(alert);
	}

	{
		const gotAlerts = await db.getAlerts({ fingerprints: [alert.fingerprint] });
		expect(gotAlerts.length).toEqual(1);
		expect(gotAlerts[0]).toMatchObject(alert);
	}

	{
		const gotAlerts = await db.getAlerts({
			filter: [
				{
					name: "test",
					value: "foo",
					isEqual: true,
					isRegex: false,
				},
			],
		});

		expect(gotAlerts.length).toEqual(1);
		expect(gotAlerts[0]).toMatchObject(alert);
	}

	{
		const gotAlerts = await db.getAlerts({ receiver: new RegExp("noop") });

		expect(gotAlerts.length).toEqual(1);
		expect(gotAlerts[0]).toMatchObject(alert);
	}
});
