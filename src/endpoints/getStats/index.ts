import { OpenAPIRoute } from "chanfana";
import { Context } from "hono";
import { z } from "zod";
import { AccountControllerActions } from "../../dos/account-controller";
import { GetStatsParams, GetStatsParamsSpec, StatsBucket, StatsResponseSpec } from "../../types/api";
import { Errors, HTTPResponses } from "../../types/http";
import { Bindings, CachedAlert, Silence } from "../../types/internal";
import { callRPC } from "../../utils/rpc";
import { checkAPIKey, toErrorString } from "../utils/auth";
import { accountControllerName } from "../utils/kv";

export class GetStats extends OpenAPIRoute {
	schema = {
		operationId: "getStats",
		summary: "Get a set of statistics",
		request: {
			params: z.object({
				resourceType: z.enum(["alerts", "silences"]).openapi({ description: "The type of statistics to retrieve" }),
			}),
			query: GetStatsParamsSpec,
		},
		responses: {
			"200": {
				description: "Sucessfully retrieved silences",
				content: {
					"application/json": {
						schema: StatsResponseSpec,
					},
				},
			},
			...Errors,
		},
	};

	private async alertStats(controller: DurableObjectStub, params: GetStatsParams) {
		const alerts = (await callRPC(controller, AccountControllerActions.GetAlerts, {
			filter: params.filter,
			startTime: params.startTime,
			endTime: params.endTime,
			active: params.active,
			silenced: params.silenced,
			inhibited: params.inhibited,
			muted: params.muted,
		})) as CachedAlert[];

		return this.group(alerts, "startsAt", params);
	}

	private async silenceStats(controller: DurableObjectStub, params: GetStatsParams) {
		const silences = (await callRPC(controller, AccountControllerActions.GetSilences, {
			matchers: params.filter,
			startTime: params.startTime,
			endTime: params.endTime,
			expired: params.expired,
		})) as Silence[];

		return this.group(silences, "startsAt", params);
	}

	private group<T>(
		values: T[],
		key: Extract<keyof T, keyof { [K in keyof T]: T[K] extends number ? K : never }>,
		params: GetStatsParams,
	) {
		if (values.length === 0) {
			return { buckets: [] };
		}

		values.sort((a, b) => (a[key] as number) - (b[key] as number));

		const buckets: StatsBucket[] = [];
		if (!params.intervalSecs) {
			// Just one big heapin bucket.
			buckets.push({
				time: new Date(params.startTime ?? params.endTime ?? Date.now()).toISOString(),
				value: values.length,
			});

			return { buckets };
		}

		const interval = params.intervalSecs * 1000;
		const start = Math.floor((values[0][key] as number) / interval) * interval;
		let currentBucket = {
			time: start,
			value: 0,
		};

		for (const value of values) {
			if ((value[key] as number) >= currentBucket.time + interval) {
				buckets.push({ time: new Date(currentBucket.time).toISOString(), value: currentBucket.value });
				currentBucket = {
					time: Math.floor((value[key] as number) / interval) * interval,
					value: 0,
				};
			}
			currentBucket.value++;
		}

		buckets.push({ time: new Date(currentBucket.time).toISOString(), value: currentBucket.value });
		return { buckets };
	}

	async handle(c: Context<{ Bindings: Bindings }>) {
		const authResult = await checkAPIKey(c.env, c.req.header("Authorization"), "get-silences");
		if (authResult.result !== "ok") {
			c.status(HTTPResponses.Unauthorized);
			return c.text(toErrorString(authResult));
		}

		const controllerName = accountControllerName(authResult.accountID);
		const controllerID = c.env.ACCOUNT_CONTROLLER.idFromName(controllerName);
		const controller = c.env.ACCOUNT_CONTROLLER.get(controllerID);
		const {
			params: { resourceType },
			query,
		} = await this.getValidatedData<typeof this.schema>();

		// TODO: Validate that alert filters are not used with silence stats and vice versa.
		let buckets;

		if (resourceType === "alerts") {
			buckets = await this.alertStats(controller, query);
		} else if (resourceType === "silences") {
			buckets = await this.silenceStats(controller, query);
		} else {
			c.status(HTTPResponses.BadRequest);
			return;
		}

		c.status(HTTPResponses.OK);
		return c.json(buckets);
	}
}
