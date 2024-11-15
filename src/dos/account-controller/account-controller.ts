import { DurableObject } from "cloudflare:workers";
import { Bindings } from "hono/types";
import { SilenceDB } from "./silence-db";
import { getAllAlerts, getAllSilences } from "./util";
import { AlertDB } from "./alert-db";

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
}
