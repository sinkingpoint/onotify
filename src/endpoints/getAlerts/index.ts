import { OpenAPIRoute } from "chanfana";
import { GettableAlertsSpec } from "../../types/api";
import { Errors, HTTPResponses } from "../../types/http";
import { Bindings } from "../../types/internal";
import { Context } from "hono";
import { checkAPIKey, toErrorString } from "../utils/auth";
import { accountControllerName } from "../utils/kv";

export class GetAlerts extends OpenAPIRoute {
  schema = {
    tags: ["alerts"],
    summary: "Get a list of alerts",
    responses: {
      "200": {
        description: "Successfully got alerts",
        content: {
          "application/json": {
            schema: GettableAlertsSpec,
          },
        },
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

    const controllerName = accountControllerName(authResult.account_id);
    const controllerID = c.env.ACCOUNT_CONTROLLER.idFromName(controllerName);
    const controller = c.env.ACCOUNT_CONTROLLER.get(controllerID);

    const outputAlerts = [];
    for (const alert of await controller.getAlerts({})) {
      outputAlerts.push({
        fingerprint: alert.fingerprint,
        labels: alert.labels,
        annotations: alert.annotations,
        startsAt: new Date(alert.startsAt).toISOString(),
        endsAt: new Date(alert.endsAt ?? 0).toISOString(),
        updatedAt: new Date(alert.updatedAt).toISOString(),
        receivers: alert.receivers.map((r) => {
          return {
            name: r,
          };
        }),
        status: {
          silencedBy: alert.silencedBy,
          inhibitedBy: alert.inhibitedBy,
          status:
            alert.silencedBy.length > 0 || alert.inhibitedBy.length > 0
              ? "supressed"
              : "active",
        },
      });
    }

    return c.json(outputAlerts, HTTPResponses.OK);
  }
}
