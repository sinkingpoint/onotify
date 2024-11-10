import { OpenAPIRoute } from "chanfana";
import { PostableAlerts, PostableAlertsSpec } from "../types/api";
import { Errors, HTTPResponses } from "../types/http";
import { Alert, AlertGroup, Bindings } from "../types/internal";
import { Context } from "hono";
import {
  FlatRouteConfig,
  RouteConfig,
  collapseRoutingTree,
} from "../types/alertmanager";
import { fingerprint } from "./utils/fingerprinting";
import { checkAPIKey, toErrorString } from "./utils/auth";
import { routingTreeKVKey } from "./utils/kv";

const REGEX_CACHE: Record<string, RegExp> = {};

export class PostAlerts extends OpenAPIRoute {
  schema = {
    tags: ["config"],
    summary: "Upload an Alertmanager config",
    request: {
      body: {
        content: {
          "application/json": {
            schema: PostableAlertsSpec,
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
    const { account_id } = authResult;
    const rawConfig = await c.env.CONFIGS.get(routingTreeKVKey(account_id));
    if (!rawConfig) {
      c.status(HTTPResponses.InternalServerError);
      return c.text("no config yet");
    }

    const routingTree: ReturnType<typeof collapseRoutingTree> =
      JSON.parse(rawConfig);

    const groups = groupAlerts(data.body, routingTree);
    const promises = [];
    for (const nodeID of Object.keys(groups)) {
      for (const group of groups[nodeID]) {
        const alertGroupControllerName = `alert-group-controller-${account_id}-${nodeID}-${group.labels}`;
        const alertGroupControllerID = c.env.ALERT_GROUP_CONTROLLER.idFromName(
          alertGroupControllerName
        );

        const alertGroupController = c.env.ALERT_GROUP_CONTROLLER.get(
          alertGroupControllerID
        );

        promises.push(
          alertGroupController.initialize(
            account_id,
            routingTree.tree[nodeID],
            group
          )
        );
      }
    }

    c.executionCtx.waitUntil(Promise.all(promises));

    c.status(HTTPResponses.OK);
    return c.text("ok");
  }
}

const groupAlerts = (
  alerts: PostableAlerts,
  { roots, tree }: ReturnType<typeof collapseRoutingTree>
): Record<string, AlertGroup[]> => {
  const groups: Record<string, AlertGroup[]> = {};
  for (const postableAlert of alerts) {
    const alert: Alert = {
      fingerprint: fingerprint(postableAlert.labels).toString(16),
      startsAt: postableAlert.startsAt ?? Date.now(),
      ...postableAlert,
    };

    const toProcess = roots.filter((r) => doesAlertMatchRoute(alert, tree[r]));

    while (toProcess.length > 0) {
      const nodeID = toProcess.pop()!;
      const node = tree[nodeID];
      if (!doesAlertMatchRoute(alert, node)) {
        continue;
      }

      if (node.receiver) {
        groupAlert(groups, nodeID, node, alert);
      }

      if (!node.continue) {
        break;
      }

      toProcess.push(...node.routes);
    }
  }

  return groups;
};

const groupAlert = (
  groups: Record<string, AlertGroup[]>,
  nodeID: string,
  node: FlatRouteConfig,
  alert: Alert
) => {
  if (!groups[nodeID]) {
    groups[nodeID] = [];
  }

  const labels =
    node.group_by?.map((labelName) => alert.labels[labelName] ?? "") ?? [];

  const groupIdx = groups[nodeID].findIndex(
    (g) =>
      g.labels.length === labels.length &&
      g.labels.every((n, i) => labels[i] === n)
  );

  if (groupIdx === -1) {
    groups[nodeID].push({ labels, alerts: [alert] });
  } else {
    groups[nodeID][groupIdx].alerts.push(alert);
  }
};

// Gets a compiled version of the given regexp, from the cache if we have already run one.
const getRegex = (r: string): RegExp => {
  // Pad with start and end chars so that we have to match the whole thing
  if (!r.startsWith("^")) {
    r = `^${r}`;
  }

  if (!r.endsWith("$")) {
    r = `${r}$`;
  }

  if (!REGEX_CACHE[r]) {
    REGEX_CACHE[r] = new RegExp(r);
  }

  return REGEX_CACHE[r];
};

const doesAlertMatchRoute = (
  a: Alert,
  r: Pick<RouteConfig, "match" | "match_re" | "matchers">
) => {
  for (const labelName of Object.keys(r.match)) {
    if ((a.labels[labelName] ?? "") !== r.match[labelName]) {
      return false;
    }
  }

  for (const labelName of Object.keys(r.match_re)) {
    const regexp = getRegex(r.match_re[labelName]);
    if (!regexp.test(a.labels[labelName] ?? "")) {
      return false;
    }
  }

  for (const m of r.matchers) {
    const testValue = a.labels[m.label_name] ?? "";
    switch (m.matcher) {
      case "=":
        if (testValue !== m.label_value) {
          return false;
        }
        break;
      case "!=":
        if (testValue === m.label_value) {
          return false;
        }
        break;
      case "=~":
      case "!~":
        const regex = getRegex(m.label_value);
        if (m.matcher === "=~" && !regex.test(testValue)) {
          return false;
        } else if (m.matcher === "!~" && regex.test(testValue)) {
          return false;
        }
        break;
    }
  }

  return true;
};
