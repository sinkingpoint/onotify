import { OpenAPIRoute } from "chanfana";
import { PostableAlerts, PostableAlertsSpec } from "../../types/api";
import { Errors, HTTPResponses } from "../../types/http";
import {
  Alert,
  AlertGroup,
  Bindings,
  ReceiveredAlert,
} from "../../types/internal";
import { Context } from "hono";
import {
  FlatRouteConfig,
  RouteConfig,
  collapseRoutingTree,
} from "../../types/alertmanager";
import { fingerprint } from "../utils/fingerprinting";
import { checkAPIKey, toErrorString } from "../utils/auth";
import { alertGroupControllerName, routingTreeKVKey } from "../utils/kv";
import { matcherMatches } from "../../utils/matcher";
import { getAnchoredRegex } from "../../utils/regex";

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
    const authResult = await checkAPIKey(
      c.env,
      c.req.header("Authorization"),
      "post-alerts"
    );
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

    const [groups, receiveredAlerts] = groupAlerts(data.body, routingTree);
    const promises = [];
    for (const nodeID of Object.keys(groups)) {
      for (const group of groups[nodeID]) {
        const controllerName = alertGroupControllerName(
          account_id,
          nodeID,
          group.labels
        );

        const alertGroupControllerID =
          c.env.ALERT_GROUP_CONTROLLER.idFromName(controllerName);

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

    const accountControllerID = c.env.ACCOUNT_CONTROLLER.idFromName(
      `account-controller-${account_id}`
    );

    const accountController = c.env.ACCOUNT_CONTROLLER.get(accountControllerID);
    promises.push(accountController.addAlerts(receiveredAlerts));

    c.executionCtx.waitUntil(Promise.all(promises));

    c.status(HTTPResponses.OK);
    return c.text("ok");
  }
}

const groupAlerts = (
  alerts: PostableAlerts,
  { roots, tree }: ReturnType<typeof collapseRoutingTree>
): [Record<string, AlertGroup[]>, ReceiveredAlert[]] => {
  const groups: Record<string, AlertGroup[]> = {};
  const receiveredAlerts: ReceiveredAlert[] = [];
  for (const postableAlert of alerts) {
    const alert: ReceiveredAlert = {
      fingerprint: fingerprint(postableAlert.labels).toString(16),
      startsAt: postableAlert.startsAt ?? Date.now(),
      receivers: [],
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
        alert.receivers.push(node.receiver);
      }

      if (!node.continue) {
        break;
      }

      toProcess.push(...node.routes);
    }

    receiveredAlerts.push(alert);
  }

  return [groups, receiveredAlerts];
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
    const regexp = getAnchoredRegex(r.match_re[labelName]);
    if (!regexp.test(a.labels[labelName] ?? "")) {
      return false;
    }
  }

  for (const m of r.matchers) {
    if (!matcherMatches(m, a, REGEX_CACHE)) {
      return false;
    }
  }

  return true;
};
