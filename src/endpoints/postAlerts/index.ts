import { OpenAPIRoute } from "chanfana";
import { PostableAlertsSpec } from "../../types/api";
import { Errors, HTTPResponses } from "../../types/http";
import { Bindings } from "../../types/internal";
import { Context } from "hono";
import { collapseRoutingTree } from "../../types/alertmanager";
import { checkAPIKey, toErrorString } from "../utils/auth";
import { alertGroupControllerName, routingTreeKVKey } from "../utils/kv";
import { groupAlerts } from "./group";

export class PostAlerts extends OpenAPIRoute {
  schema = {
    tags: ["config"],
    summary: "Upload an Alertmanager config",
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
    const authResult = await checkAPIKey(
      c.env,
      c.req.header("Authorization"),
      "post-alerts"
    );
    if (authResult.result !== "ok") {
      c.status(HTTPResponses.Unauthorized);
      return c.text(toErrorString(authResult));
    }

    const data = await this.getValidatedData<typeof this.schema>();
    const { account_id } = authResult;
    const rawConfig = await c.env.CONFIGS.get(routingTreeKVKey(account_id));
    if (!rawConfig) {
      c.status(HTTPResponses.InternalServerError);
      return c.text("no config yet");
    }

    const routingTree: ReturnType<typeof collapseRoutingTree> =
      JSON.parse(rawConfig);

    const [groups, receiveredAlerts] = groupAlerts(data.body, routingTree);
    const promises = [];
    for (const nodeID of Object.keys(groups)) {
      for (const group of groups[nodeID]) {
        const controllerName = alertGroupControllerName(
          account_id,
          nodeID,
          group.labels
        );

        const alertGroupControllerID =
          c.env.ALERT_GROUP_CONTROLLER.idFromName(controllerName);

        const alertGroupController = c.env.ALERT_GROUP_CONTROLLER.get(
          alertGroupControllerID
        );

        promises.push(
          alertGroupController.initialize(
            account_id,
            routingTree.tree[nodeID],
            group
          )
        );
      }
    }

    const accountControllerID = c.env.ACCOUNT_CONTROLLER.idFromName(
      `account-controller-${account_id}`
    );

    const accountController = c.env.ACCOUNT_CONTROLLER.get(accountControllerID);
    promises.push(accountController.addAlerts(receiveredAlerts));
    for (const groupKey of Object.keys(groups)) {
      promises.push(accountController.addAlertGroups(groups[groupKey]));
    }
    c.executionCtx.waitUntil(Promise.all(promises));

    c.status(HTTPResponses.OK);
    return c.text("ok");
  }
}
