import { DurableObject } from "cloudflare:workers";
import { Bindings } from "../../types/internal";

const SILENCE_ID_KEY = "silenceID";
const ACCOUNT_ID_KEY = "accountID";
const START_TIME_KEY = "start-time";
const END_TIME_KEY = "end-time";

const getAlarmTime = (startsAt: number, endsAt: number) => {
	const silenceStarted = startsAt < Date.now();
	const silenceEnded = endsAt < Date.now();
	if (!silenceStarted) {
		return startsAt;
	} else if (!silenceEnded) {
		return endsAt;
	} else {
		return 0;
	}
};

export default class SilenceController extends DurableObject<Bindings> {
	silenceID: string;
	accountControllerID: DurableObjectId | undefined;
	startTime: number;
	endTime: number;
	constructor(ctx: DurableObjectState, env: Bindings) {
		super(ctx, env);

		this.silenceID = "";
		this.startTime = 0;
		this.endTime = 0;

		ctx.blockConcurrencyWhile(async () => {
			this.silenceID = (await ctx.storage.get(SILENCE_ID_KEY)) ?? "";
			const accountControllerIDStr = await ctx.storage.get<string>(ACCOUNT_ID_KEY);
			if (accountControllerIDStr) {
				this.accountControllerID = env.ACCOUNT_CONTROLLER.idFromString(accountControllerIDStr);
			}
			this.startTime = (await ctx.storage.get(START_TIME_KEY)) ?? 0;
			this.endTime = (await ctx.storage.get(END_TIME_KEY)) ?? 0;
		});
	}

	async initialize(accountControllerID: DurableObjectId, silenceID: string, startTime: number, endTime: number) {
		const newAlarmTime = getAlarmTime(startTime, endTime);
		if (newAlarmTime === 0) {
			return;
		}

		this.accountControllerID = accountControllerID;
		this.silenceID = silenceID;
		this.startTime = startTime;
		this.endTime = endTime;

		await this.ctx.storage.put(SILENCE_ID_KEY, silenceID);
		await this.ctx.storage.put(ACCOUNT_ID_KEY, accountControllerID.toString());
		await this.ctx.storage.put(START_TIME_KEY, startTime);
		await this.ctx.storage.put(END_TIME_KEY, endTime);
		const currentAlarm = await this.ctx.storage.getAlarm();
		if (!currentAlarm || currentAlarm !== newAlarmTime) {
			await this.ctx.storage.setAlarm(newAlarmTime);
		}
	}

	async delete() {
		await this.ctx.storage.deleteAll();
		await this.ctx.storage.deleteAlarm();
	}

	async alarm(alarmInfo?: AlarmInvocationInfo) {
		if (!this.accountControllerID) {
			throw `BUG: SilenceController ${this.silenceID} has no accountControllerID`;
		}

		const accountController = this.env.ACCOUNT_CONTROLLER.get(this.accountControllerID);

		if (this.endTime <= Date.now()) {
			await accountController.markSilenceExpired(this.silenceID);
			await this.delete();
		} else if (this.startTime <= Date.now()) {
			await accountController.markSilenceStarted(this.silenceID);
			await this.ctx.storage.setAlarm(this.endTime);
		} else {
			await this.ctx.storage.setAlarm(this.startTime);
		}
	}
}
