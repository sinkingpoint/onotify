import { OpenAPIRoute } from "chanfana";
import { GettableSilencesSpec } from "../types/api";
import { Errors, HTTPResponses } from "../types/http";
import { Context } from "hono";
import { accountControllerName } from "./utils/kv";
import { Bindings } from "../types/internal";
import { checkAPIKey, toErrorString } from "./utils/auth";

export class GetSilences extends OpenAPIRoute {
  schema = {
    tags: ["config"],
    summary: "Upload an Alertmanager config",
    request: {
      // TODO: Support matchers here.
    },
    responses: {
      "200": {
        description: "Sucessfully pushed alerts",
        content: {
          "application/json": {
            schema: GettableSilencesSpec,
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

    const silences = await controller.getSilences([]);

    c.status(200);
    return c.json(silences);
  }
}
