import { instrumentDO } from "@microlabs/otel-cf-workers";
import { trace } from "@opentelemetry/api";
import { Bindings } from "../../types/internal";
import { OTelConfFn, runInSpan, runInSyncSpan } from "../../utils/observability";
import { callRPC, rpcFetch } from "../../utils/rpc";
import { AccountControllerActions } from "../account-controller";

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

export enum SilenceControllerActions {
	Initialize = "initialize",
	Delete = "delete",
}

const getTracer = () => {
	return trace.getTracer("SilenceController");
};

class SilenceControllerDO implements DurableObject {
	silenceID: string;
	accountControllerID: string;
	startTime: number;
	endTime: number;
	state: DurableObjectState;
	env: Bindings;
	constructor(state: DurableObjectState, env: Bindings) {
		this.silenceID = "";
		this.startTime = 0;
		this.endTime = 0;
		this.accountControllerID = "";
		this.state = state;
		this.env = env;

		runInSyncSpan(getTracer(), "SilenceController::constructor", {}, () => {
			state.blockConcurrencyWhile(async () => {
				this.silenceID = (await state.storage.get(SILENCE_ID_KEY)) ?? "";
				this.accountControllerID = (await state.storage.get<string>(ACCOUNT_ID_KEY)) ?? "";
				this.startTime = (await state.storage.get(START_TIME_KEY)) ?? 0;
				this.endTime = (await state.storage.get(END_TIME_KEY)) ?? 0;
			});
		});
	}

	private async initialize({
		accountControllerID,
		silenceID,
		startTime,
		endTime,
	}: {
		accountControllerID: string;
		silenceID: string;
		startTime: number;
		endTime: number;
	}) {
		return runInSpan(getTracer(), "SilenceController::initialize", {}, async (span) => {
			const newAlarmTime = getAlarmTime(startTime, endTime);
			if (newAlarmTime === 0) {
				return;
			}

			this.accountControllerID = accountControllerID;
			this.silenceID = silenceID;
			this.startTime = startTime;
			this.endTime = endTime;

			await this.state.storage.put(SILENCE_ID_KEY, silenceID);
			await this.state.storage.put(ACCOUNT_ID_KEY, accountControllerID.toString());
			await this.state.storage.put(START_TIME_KEY, startTime);
			await this.state.storage.put(END_TIME_KEY, endTime);
			const currentAlarm = await this.state.storage.getAlarm();
			if (!currentAlarm || currentAlarm !== newAlarmTime) {
				span.addEvent("Reset Alarm");
				await this.state.storage.setAlarm(newAlarmTime);
			}
		});
	}

	private async delete() {
		return runInSpan(getTracer(), "SilenceController::delete", {}, async () => {
			await this.state.storage.deleteAll();
			await this.state.storage.deleteAlarm();
		});
	}

	async alarm() {
		if (!this.accountControllerID) {
			throw `BUG: SilenceController ${this.silenceID} has no accountControllerID`;
		}

		const accountControllerID = this.env.ACCOUNT_CONTROLLER.idFromString(this.accountControllerID);
		const accountController = this.env.ACCOUNT_CONTROLLER.get(accountControllerID);

		if (this.endTime <= Date.now()) {
			await callRPC(accountController, AccountControllerActions.MarkSilenceExpired, this.silenceID);
			await this.delete();
		} else if (this.startTime <= Date.now()) {
			await callRPC(accountController, AccountControllerActions.MarkSilenceStarted, this.silenceID);
			await this.state.storage.setAlarm(this.endTime);
		} else {
			await this.state.storage.setAlarm(this.startTime);
		}
	}

	async fetch(request: Request) {
		const rpcMethods = {
			[SilenceControllerActions.Initialize]: this.initialize,
			[SilenceControllerActions.Delete]: this.delete,
		};

		return rpcFetch(this, request, rpcMethods);
	}
}

const SilenceController = instrumentDO(SilenceControllerDO, OTelConfFn);

export default SilenceController;
