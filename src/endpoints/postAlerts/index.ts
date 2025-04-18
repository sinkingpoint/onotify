import { OpenAPIRoute } from "chanfana";
import { Context } from "hono";
import { AccountControllerActions } from "../../dos/account-controller";
import { AlertGroupControllerActions } from "../../dos/alert-group-controller";
import { collapseRoutingTree } from "../../types/alertmanager";
import { PostableAlertsSpec } from "../../types/api";
import { Errors, HTTPResponses } from "../../types/http";
import { Bindings } from "../../types/internal";
import { callRPC } from "../../utils/rpc";
import { checkAPIKey, toErrorString } from "../utils/auth";
import { alertGroupControllerName, routingTreeKVKey } from "../utils/kv";
import { groupAlerts } from "./group";

export class PostAlerts extends OpenAPIRoute {
	schema = {
		operationId: "postAlerts",
		tags: ["alerts"],
		summary: "Add alerts to the system",
		request: {
			body: {
				content: {
					"application/json": {
						schema: PostableAlertsSpec,
					},
				},
			},
		},
		responses: {
			"200": {
				description: "Sucessfully pushed alerts",
			},
			...Errors,
		},
	};

	async handle(c: Context<{ Bindings: Bindings }>) {
		const authResult = await checkAPIKey(c.env, c.req.header("Authorization"), "post-alerts");
		if (authResult.result !== "ok") {
			c.status(HTTPResponses.Unauthorized);
			return c.text(toErrorString(authResult));
		}

		const data = await this.getValidatedData<typeof this.schema>();
		const { accountID: account_id } = authResult;
		const rawConfig = await c.env.CONFIGS.get(routingTreeKVKey(account_id));
		if (!rawConfig) {
			c.status(HTTPResponses.InternalServerError);
			return c.text("no config yet");
		}

		const routingTree: ReturnType<typeof collapseRoutingTree> = JSON.parse(rawConfig);

		const [groups, receiveredAlerts] = groupAlerts(data.body, routingTree);
		const promises = [];
		for (const nodeID of Object.keys(groups)) {
			for (const group of groups[nodeID]) {
				const controllerName = alertGroupControllerName(account_id, nodeID, group.labelValues);
				const alertGroupControllerID = c.env.ALERT_GROUP_CONTROLLER.idFromName(controllerName);
				const alertGroupController = c.env.ALERT_GROUP_CONTROLLER.get(alertGroupControllerID);

				promises.push(
					callRPC(alertGroupController, AlertGroupControllerActions.Initialize, {
						account_id,
						route: routingTree.tree[nodeID],
						group,
					}),
				);
			}
		}

		const accountControllerID = c.env.ACCOUNT_CONTROLLER.idFromName(`account-controller-${account_id}`);

		const accountController = c.env.ACCOUNT_CONTROLLER.get(accountControllerID);
		promises.push(callRPC(accountController, AccountControllerActions.AddAlerts, receiveredAlerts));
		for (const groupKey of Object.keys(groups)) {
			promises.push(callRPC(accountController, AccountControllerActions.AddAlertGroups, groups[groupKey]));
		}
		c.executionCtx.waitUntil(Promise.all(promises));

		c.status(HTTPResponses.OK);
		return c.text("ok");
	}
}
