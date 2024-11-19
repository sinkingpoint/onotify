import { DurableObject } from "cloudflare:workers";
import { Bindings } from "hono/types";
import { SilenceDB } from "./silence-db";
import { getAllAlerts, getAllSilences } from "./util";
import { AlertDB } from "./alert-db";
import { GetAlertsOptions, ReceiveredAlert } from "../../types/internal";

export class AccountController extends DurableObject {
  silenceStorage: SilenceDB;
  alertStorage: AlertDB;

  constructor(state: DurableObjectState, env: Bindings) {
    super(state, env);

    this.silenceStorage = new SilenceDB(state.storage);
    this.alertStorage = new AlertDB(state.storage, this.silenceStorage);
    state.blockConcurrencyWhile(async () => {
      const silences = await getAllSilences(state.storage);
      this.silenceStorage.init(silences);

      const alerts = await getAllAlerts(state.storage);
      this.alertStorage.init(alerts);
    });
  }

  async addAlerts(a: ReceiveredAlert[]) {
    a.forEach(async (a) => {
      await this.alertStorage.addAlert(a);
    });
  }

  async getAlert(fingerprint: string) {
    return this.alertStorage.getAlert(fingerprint);
  }

  getAlerts(options: GetAlertsOptions) {
    return this.alertStorage.getAlerts(options);
  }
}
