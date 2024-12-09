import { fingerprintArray } from "../../endpoints/utils/fingerprinting";
import { GetAlertGroupsOptions } from "../../types/api";
import { AlertGroup, AlertState } from "../../types/internal";
import { matcherMatches } from "../../utils/matcher";
import { ALERT_GROUP_KV_PREFIX } from "./util";

interface AlertGroupStorage {
  get: (name: string) => Promise<AlertGroup | undefined>;
  put: (name: string, alert: AlertGroup) => Promise<void>;
  delete: (name: string) => Promise<boolean>;
}

const alertGroupKey = (nodeID: string, labels: string[]) => {
  return `${ALERT_GROUP_KV_PREFIX}-${nodeID}-${fingerprintArray(labels)}`;
};

export class AlertGroupDB {
  groups: Map<string, AlertGroup>;
  storage: AlertGroupStorage;

  constructor(storage: AlertGroupStorage) {
    this.storage = storage;
    this.groups = new Map();
  }

  init(groups: Map<string, AlertGroup>) {
    this.groups = groups;
  }

  async getAlertGroup(nodeID: string, labels: string[]) {
    const key = alertGroupKey(nodeID, labels);

    if (this.groups.has(key)) {
      return this.groups.get(key);
    }

    const group = await this.storage.get(key);
    if (group) {
      this.groups.set(key, group);
    }

    return group;
  }

  async getAlertGroups({
    receiver,
    filter,
  }: Partial<Pick<GetAlertGroupsOptions, "receiver" | "filter">>) {
    let groups: AlertGroup[] = [...this.groups.values()];
    if (receiver) {
      groups = groups.filter((g) => {
        return receiver.test(g.receiver);
      });
    }

    if (filter) {
      groups = groups.filter((g) => {
        const labels: Record<string, string> = {};
        for (let i = 0; i < g.labelNames.length; i++) {
          labels[g.labelNames[i]] = g.labelValues[i];
        }

        return filter.every((f) => matcherMatches(f, labels));
      });
    }

    return [...groups];
  }

  async mergeAlertGroup(newGroup: AlertGroup) {
    const currentGroup = await this.getAlertGroup(
      newGroup.nodeID,
      newGroup.labelValues
    );
    const key = alertGroupKey(newGroup.nodeID, newGroup.labelValues);
    if (!currentGroup) {
      // For new groups, we only store the firing alerts.
      const newAlerts = newGroup.alerts.filter(
        (n) => n.state === AlertState.Firing
      );
      newGroup = { ...newGroup, alerts: newAlerts };
      this.storage.put(key, newGroup);
      this.groups.set(key, newGroup);
      return;
    }

    // Filter out newly resolved alerts from the existing alert group.
    currentGroup.alerts = currentGroup.alerts.filter((a) => {
      const newAlert = newGroup.alerts.find(
        (newA) => newA.fingerprint === a.fingerprint
      );
      return !newAlert || newAlert.state !== AlertState.Resolved;
    });

    // Find the new alerts that are firing, but not in the current group.
    const newAlerts = newGroup.alerts.filter((a) => {
      const resolved = a.state === AlertState.Resolved;
      const exists = currentGroup.alerts
        .map((a) => a.fingerprint)
        .includes(a.fingerprint);
      return !resolved && !exists;
    });

    currentGroup.alerts.push(...newAlerts);
    if (currentGroup.alerts.length === 0) {
      this.storage.delete(key);
      this.groups.delete(key);
    } else {
      this.storage.put(key, currentGroup);
      this.groups.set(key, currentGroup);
    }
  }
}
