import { DurableObject } from "cloudflare:workers";
import { AlertGroup, AlertState, Bindings } from "../../types/internal";
import { FlatRouteConfig } from "../../types/alertmanager";
import { AlertStateMachine } from "./state-machine";
import {
  ACCOUNT_ID_KEY,
  ALERTS_PREFIX,
  extractFingerprint,
  GroupedAlert,
  LABELS_KV_KEY,
  PAGE_SIZE,
  ROUTE_KV_KEY,
} from "./util";

// Gets the list of alert fingerprints in storage.
const getAlertFingerprints = async (storage: DurableObjectStorage) => {
  const pending_alerts = [];
  const active_alerts = [];
  const options: DurableObjectListOptions = { prefix: ALERTS_PREFIX };
  if (PAGE_SIZE > 0) {
    options.limit = PAGE_SIZE;
  }

  let page = await storage.list<GroupedAlert>(options);
  while (page.size > 0) {
    const pending_fingerprints = page
      .keys()
      .filter((k) => page.get(k)!.pending)
      .map((kvKey) => extractFingerprint(kvKey));

    const active_fingerprints = page
      .keys()
      .filter((k) => !page.get(k)!.pending)
      .map((kvKey) => extractFingerprint(kvKey));

    pending_alerts.push(...pending_fingerprints);
    active_alerts.push(...active_fingerprints);
    page = await storage.list({
      ...options,
      startAfter: pending_alerts[pending_alerts.length - 1],
    });
  }

  return [pending_alerts, active_alerts];
};

export class AlertGroupController extends DurableObject<Bindings> {
  route: FlatRouteConfig | undefined;
  labels: string[] | undefined;
  state_machine: AlertStateMachine;
  account_id: string;
  constructor(state: DurableObjectState, env: Bindings) {
    super(state, env);
    this.state_machine = new AlertStateMachine(this.ctx.storage);
    this.account_id = "";

    state.blockConcurrencyWhile(async () => {
      this.account_id = (await this.ctx.storage.get(ACCOUNT_ID_KEY)) ?? "";
      this.labels = await this.ctx.storage.get(LABELS_KV_KEY);
      this.route = await this.ctx.storage.get(ROUTE_KV_KEY);
      const [pending_alerts, active_alerts] = await getAlertFingerprints(
        this.ctx.storage
      );
      this.state_machine.initialise(pending_alerts, active_alerts);
    });
  }

  async initialize(
    account_id: string,
    route: FlatRouteConfig,
    group: AlertGroup
  ) {
    this.account_id = account_id;
    this.labels = this.labels ?? group.labels;
    this.route = route;

    const equalLabels = arraysEqual(this.labels, group.labels);
    if (!equalLabels) {
      throw `Expected the given labels (${group.labels}) to be the same as the existing labels (${this.labels})`;
    }

    await this.ctx.storage.put(LABELS_KV_KEY, this.labels);
    await this.ctx.storage.put(ROUTE_KV_KEY, this.route);
    await this.ctx.storage.put(ACCOUNT_ID_KEY, this.account_id);
    await Promise.all(
      group.alerts.map((a) => this.state_machine.handlePendingAlert(a))
    );

    if (!(await this.ctx.storage.getAlarm())) {
      // We have never sent a notification for this group, so wait `group_wait`.
      await this.ctx.storage.setAlarm(Date.now() + this.route.group_wait);
    }
  }

  async alarm() {
    const page_size = PAGE_SIZE > 0 ? PAGE_SIZE : undefined;
    while (this.state_machine.hasPendingAlerts()) {
      const alerts = await this.state_machine.flushPendingAlerts(page_size);
      const dispatch = await this.env.ALERT_DISPATCH.create({
        params: {
          accountId: this.account_id,
          alertFingerprints: alerts.map((a) => a.fingerprint),
          receiverName: this.route?.receiver,
          groupLabels: this.labels,
        },
      });

      console.log("dispatching");
    }

    if (this.state_machine.hasActiveAlerts()) {
      // We have active alerts, so send the next alerts after `group_interval`.
      await this.ctx.storage.setAlarm(Date.now() + this.route!.group_interval);
    } else {
      // All the alerts have been dispatched. Delete this group.
      await this.ctx.storage.deleteAll();
    }
  }
}

const arraysEqual = (a: string[], b: string[]): boolean => {
  return a.length === b.length && a.every((n, i) => b[i] === n);
};
