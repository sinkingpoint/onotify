import { OpenAPIRoute } from "chanfana";
import { GetAlertGroupsOptionsSpec } from "../../types/api";
import { Errors, HTTPResponses } from "../../types/http";
import { Context } from "hono";
import { Bindings } from "../../types/internal";
import { checkAPIKey, toErrorString } from "../utils/auth";
import { accountControllerName } from "../utils/kv";
import { internalAlertToAlertmanager } from "../utils/api";

export class GetAlertGroups extends OpenAPIRoute {
  schema = {
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
    const authResult = await checkAPIKey(
      c.env,
      c.req.header("Authorization"),
      "get-alerts"
    );

    if (authResult.result !== "ok") {
      c.status(HTTPResponses.Unauthorized);
      return c.text(toErrorString(authResult));
    }

    const query = (await this.getValidatedData<typeof this.schema>()).query;
    const controllerName = accountControllerName(authResult.accountID);
    const controllerID = c.env.ACCOUNT_CONTROLLER.idFromName(controllerName);
    const controller = c.env.ACCOUNT_CONTROLLER.get(controllerID);

    const internalGroups = await controller.getAlertGroups(query);
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
