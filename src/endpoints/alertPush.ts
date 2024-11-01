import { OpenAPIRoute } from "chanfana";
import { PostableAlerts } from "../types/api";
import { Context } from "hono";
import { checkAPIKey } from "./utils";
import { Errors, HTTPResponses as HTTPResponse } from "../types/http";
import { Alert, Bindings } from "../types/internal";
import { fingerprint } from "./utils/fingerprinting";
import { date } from "zod";

const API_SCOPE = "post-alerts";

export class PostAlerts extends OpenAPIRoute {
  schema = {
    tags: ["alert"],
    summary: "Create new Alerts",
    request: {
      body: {
        content: {
          "application/json": {
            schema: PostableAlerts,
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Create alerts response",
      },
      ...Errors,
    },
  };

  async handle(c: Context<{ Bindings: Bindings }>) {
    // Get validated data
    const data = await this.getValidatedData<typeof this.schema>();

    const authHeader = c.req.header("Authorization");
    const authResult = await checkAPIKey(c.env, authHeader, API_SCOPE);
    if (authResult.result !== "ok") {
      c.status(HTTPResponse.Unauthorized);
      return c.text(authResult.text);
    }

    const alerts: Alert[] = [];
    for (const alert of data.body) {
      const startsAt = Date.parse(alert.startsAt) / 1000;
      const endsAt = alert.endsAt ? Date.parse(alert.endsAt) / 1000 : 0;

      alerts.push({
        fingerprint: fingerprint(alert.labels),
        status: alert.status,
        name: alert.labels["__alertname__"] ?? "",
        labels: alert.labels,
        annotations: alert.annotations ?? {},
        startsAt,
        endsAt,
      });
    }

    const id = c.env.ACCOUNT_CONTROLLER.idFromName(authResult.account_id);
    const controller = c.env.ACCOUNT_CONTROLLER.get(id);

    c.executionCtx.waitUntil(controller.ingestAlerts(alerts));

    c.status(HTTPResponse.OK);
    return c.text("ok");
  }
}
