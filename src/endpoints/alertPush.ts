import { OpenAPIRoute } from "chanfana";
import { Bindings, Errors, HTTPResponses, PostableAlerts } from "../types";
import { Context } from "hono";
import { checkAPIKey } from "./utils";

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
      c.status(HTTPResponses.Unauthorized);
      return c.text(authResult.text);
    }

    c.status(HTTPResponses.OK);
    return c.text("ok");
  }
}
