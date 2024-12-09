import { OpenAPIRoute } from "chanfana";
import {
  AlertmanagerConfigSpec,
  collapseRoutingTree,
  Receiver,
  TimeInterval,
} from "../types/alertmanager";
import { Errors, HTTPResponses } from "../types/http";
import { Context } from "hono";
import { Bindings } from "../types/internal";
import { checkAPIKey, toErrorString } from "./utils/auth";
import {
  globalTreeKVKey,
  inhibitionsKVKey,
  receiversKVKey,
  routingTreeKVKey,
  timeIntervalsKVKey,
} from "./utils/kv";

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
    const authResult = await checkAPIKey(
      c.env,
      c.req.header("Authorization"),
      "upload-config"
    );
    if (authResult.result !== "ok") {
      c.status(HTTPResponses.Unauthorized);
      return c.text(toErrorString(authResult));
    }

    const { accountID: account_id } = authResult;

    // Get validated data
    const data = await this.getValidatedData<typeof this.schema>();
    const config = data.body;

    const routingTree = collapseRoutingTree(config);
    const receivers: Record<string, Receiver> = {};
    for (const receiver of config.receivers) {
      receivers[receiver.name] = receiver;
    }

    const timeIntervals: Record<string, TimeInterval> = {};
    for (const interval of config.time_intervals) {
      timeIntervals[interval.name] = interval;
    }

    const promises = [];

    promises.push(
      c.env.CONFIGS.put(
        globalTreeKVKey(account_id),
        JSON.stringify(config.global)
      )
    );

    promises.push(
      c.env.CONFIGS.put(
        routingTreeKVKey(account_id),
        JSON.stringify(routingTree)
      )
    );

    promises.push(
      c.env.CONFIGS.put(receiversKVKey(account_id), JSON.stringify(receivers))
    );

    promises.push(
      c.env.CONFIGS.put(
        inhibitionsKVKey(account_id),
        JSON.stringify(config.inhibit_rules)
      )
    );

    promises.push(
      c.env.CONFIGS.put(
        timeIntervalsKVKey(account_id),
        JSON.stringify(timeIntervals)
      )
    );

    await Promise.all(promises);
    // TODO(https://github.com/sinkingpoint/onotify/issues/4, https://github.com/sinkingpoint/onotify/issues/5): Handle custom templates + `mute_time_intervals`

    return c.text("ok");
  }
}
