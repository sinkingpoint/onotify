import { OpenAPIRoute } from "chanfana";
import { Errors, PostableAlerts } from "../types";

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

  async handle(c) {
    // Get validated data
    const data = await this.getValidatedData<typeof this.schema>();
  }
}
