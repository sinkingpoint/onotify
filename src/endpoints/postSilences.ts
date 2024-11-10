import { OpenAPIRoute } from "chanfana";
import { PostableSilenceSpec } from "../types/api";
import { Errors, HTTPResponses } from "../types/http";
import { Bindings } from "../types/internal";
import { Context } from "hono";
import { checkAPIKey, toErrorString } from "./utils/auth";

export class PostSilence extends OpenAPIRoute {
  schema = {
    tags: ["config"],
    summary: "Upload an Alertmanager config",
    request: {
      body: {
        content: {
          "application/json": {
            schema: PostableSilenceSpec,
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
    const authResult = await checkAPIKey(c.env, c.req.header("Authorization"));
    if (authResult.result !== "ok") {
      c.status(HTTPResponses.Unauthorized);
      return c.text(toErrorString(authResult));
    }

    const data = await this.getValidatedData<typeof this.schema>();
    console.log(data);

    c.status(HTTPResponses.OK);
    return c.text("ok");
  }
}
