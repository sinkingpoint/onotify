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
  globalKVTreeKey,
  inhibitionsKVKey,
  receiversKVKey,
  routingKVTreeKey,
  timeIntervalsKVKey,
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
    const authResult = await checkAPIKey(c.env, c.req.header("Authorization"));
    if (authResult.result !== "ok") {
      c.status(HTTPResponses.Unauthorized);
      return c.text(toErrorString(authResult));
    }

    const { account_id } = authResult;

    // Get validated data
    const data = await this.getValidatedData<typeof this.schema>();
    const config = data.body;

    const routingTree = collapseRoutingTree(config);
    const receivers = config.receivers.reduce(
      (prev, curr) => (prev[curr.name] = curr),
      {}
    );
    const timeIntervals = config.time_intervals.reduce(
      (prev, curr) => (prev[curr.name] = curr),
      {}
    );

    c.env.CONFIGS.put(
      globalKVTreeKey(account_id),
      JSON.stringify(config.global)
    );

    c.env.CONFIGS.put(
      routingKVTreeKey(account_id),
      JSON.stringify(routingTree)
    );

    c.env.CONFIGS.put(receiversKVKey(account_id), JSON.stringify(receivers));
    c.env.CONFIGS.put(
      inhibitionsKVKey(account_id),
      JSON.stringify(config.inhibit_rules)
    );
    c.env.CONFIGS.put(
      timeIntervalsKVKey(account_id),
      JSON.stringify(timeIntervals)
    );

    // TODO: Handle custom templates + `mute_time_intervals`

    return c.text("ok");
  }
}
