import { DurableObject } from "cloudflare:workers";
import { Alert, Bindings } from "../../types/internal";

export class AccountController extends DurableObject<Bindings> {
  constructor(state: DurableObjectState, env: Bindings) {
    super(state, env);
  }

  ingestAlerts(alerts: Alert[]) {
    const groupByName: Record<string, Alert[]> = {};
    for (const alert of alerts) {
      if (groupByName[alert.name]) {
        groupByName[alert.name].push(alert);
      } else {
        groupByName[alert.name] = [alert];
      }
    }
  }
}
