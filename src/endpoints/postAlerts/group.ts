import {
  collapseRoutingTree,
  FlatRouteConfig,
  RouteConfig,
} from "../../types/alertmanager";
import { PostableAlerts } from "../../types/api";
import { Alert, AlertGroup, ReceiveredAlert } from "../../types/internal";
import { matcherMatches } from "../../utils/matcher";
import { getAnchoredRegex } from "../../utils/regex";
import { fingerprint } from "../utils/fingerprinting";

const REGEX_CACHE: Record<string, RegExp> = {};

export const groupAlerts = (
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
