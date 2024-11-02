import { OpenAPIRoute } from "chanfana";
import { AlertmanagerConfig, HTTPConfig } from "../types/alertmanager";
import { Errors } from "../types/http";
import { Context } from "hono";
import { Bindings } from "../types/internal";

export class PostConfig extends OpenAPIRoute {
  schema = {
    tags: ["config"],
    summary: "Upload an Alertmanager config",
    request: {
      body: {
        content: {
          "application/json": {
            schema: AlertmanagerConfig,
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Successfully uploaded config",
      },
      ...Errors,
    },
  };

  async handle(c: Context<{ Bindings: Bindings }>) {
    // Get validated data
    const data = await this.getValidatedData<typeof this.schema>();
    console.log(data);

    return c.text("ok");
  }
}
