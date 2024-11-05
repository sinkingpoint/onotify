import { OpenAPIRoute } from "chanfana";
import {
  AlertmanagerConfigSpec,
  collapseRoutingTree,
} from "../types/alertmanager";
import { Errors, HTTPResponses } from "../types/http";
import { Context } from "hono";
import { Bindings } from "../types/internal";
import {
  checkAPIKey,
  inhibitionsKVKey,
  receiversKVKey,
  routingKVTreeKey,
  toErrorString,
} from "./utils";

export class PostConfig extends OpenAPIRoute {
  schema = {
    tags: ["config"],
    summary: "Upload an Alertmanager config",
    request: {
      body: {
        content: {
          "application/json": {
            schema: AlertmanagerConfigSpec,
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
    const authResult = await checkAPIKey(c.env, c.req.header["Authorization"]);
    if (authResult.result !== "ok") {
      c.status(HTTPResponses.Unauthorized);
      return c.text(toErrorString(authResult));
    }

    const { user_id, account_id, scopes } = authResult;

    // Get validated data
    const data = await this.getValidatedData<typeof this.schema>();
    const config = data.body;
    const routingTree = collapseRoutingTree(config);
    c.env.CONFIGS.put(
      routingKVTreeKey(account_id),
      JSON.stringify(routingTree)
    );

    const receivers = config.receivers.reduce(
      (prev, curr) => (prev[curr.name] = curr),
      {}
    );

    c.env.CONFIGS.put(receiversKVKey(account_id), JSON.stringify(receivers));
    c.env.CONFIGS.put(
      inhibitionsKVKey(account_id),
      JSON.stringify(config.inhibit_rules)
    );

    // // Files from which custom notification template definitions are read.
    // // The last component may use a wildcard matcher, e.g. 'templates/*.tmpl'.
    // templates: z.array(z.string()).default([]),

    // // DEPRECATED: use time_intervals below.
    // // A list of mute time intervals for muting routes.
    // mute_time_interval: z.array(z.string()).default([]),

    // // A list of time intervals for muting/activating routes.
    // time_intervals: z.array(TimeInterval).default([]),

    return c.text("ok");
  }
}
