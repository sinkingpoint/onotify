import { OpenAPIRoute } from "chanfana";
import { Context } from "hono";
import { callRPC } from "utils/rpc";
import { AccountControllerActions } from "../../dos/account-controller";
import { GetAlertGroupsOptionsSpec } from "../../types/api";
import { Errors, HTTPResponses } from "../../types/http";
import { Bindings, HydratedAlertGroup } from "../../types/internal";
import { internalAlertToAlertmanager } from "../utils/api";
import { checkAPIKey, toErrorString } from "../utils/auth";
import { accountControllerName } from "../utils/kv";

export class GetAlertGroups extends OpenAPIRoute {
	schema = {
		operationId: "getAlertGroups",
		tags: ["alerts"],
		summary: "Get a list of alert groups",
		request: {
			query: GetAlertGroupsOptionsSpec.openapi("getAlertGroupOptions"),
		},
		responses: {
			"200": {
				description: "Successfully got alert groups",
			},
			...Errors,
		},
	};

	async handle(c: Context<{ Bindings: Bindings }>) {
		const authResult = await checkAPIKey(c.env, c.req, "read-alerts");

		if (authResult.result !== "ok") {
			c.status(HTTPResponses.Unauthorized);
			return c.text(toErrorString(authResult));
		}

		const query = (await this.getValidatedData<typeof this.schema>()).query;
		const controllerName = accountControllerName(authResult.accountID);
		const controllerID = c.env.ACCOUNT_CONTROLLER.idFromName(controllerName);
		const controller = c.env.ACCOUNT_CONTROLLER.get(controllerID);
		const internalGroups = (await callRPC(
			controller,
			AccountControllerActions.GetAlertGroups,
			query,
		)) as HydratedAlertGroup[];
		const foldedAlerts = internalGroups.map((g) => {
			const labels: Record<string, string> = {};
			for (let i = 0; i < g.labelNames.length; i++) {
				labels[g.labelNames[i]] = g.labelValues[i];
			}

			return {
				labels,
				receiver: {
					name: g.receiver,
				},
				alerts: g.alerts.map((a) => internalAlertToAlertmanager(a)),
			};
		});
		c.status(HTTPResponses.OK);
		return c.json(foldedAlerts);
	}
}
