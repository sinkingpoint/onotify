import { Alert } from "../../types/internal";
import { alertIsSame } from "../../utils/alert";
import { SilenceDB } from "./silence-db";
import { alertKVKey, CachedAlert } from "./util";

export interface AlertStorage {
  get: (fingerprint: string) => Promise<CachedAlert | undefined>;
  put: (fingerprint: string, alert: CachedAlert) => Promise<void>;
  delete: (fingerprint: string) => Promise<boolean>;
}

export class AlertDB {
  alerts: Map<string, CachedAlert>;
  storage: AlertStorage;
  silenceDB: SilenceDB;
  constructor(storage: AlertStorage, silenceDB: SilenceDB) {
    this.storage = storage;
    this.silenceDB = silenceDB;
    this.alerts = new Map();
  }

  init(alerts: Map<string, CachedAlert>) {
    this.alerts = alerts;
  }

  async addAlert(a: Alert) {
    const cached = this.alerts.get(a.fingerprint);
    if (cached && alertIsSame(a, cached)) {
      return;
    }

    const silencedBy = cached
      ? cached.silencedBy
      : this.silenceDB.silencedBy(a);

    const inhibitedBy = cached ? cached.inhibitedBy : [];
    this.storeAlert({
      silencedBy,
      inhibitedBy,
      ...a,
    });
  }

  private storeAlert(a: CachedAlert) {
    this.storage.put(alertKVKey(a.fingerprint), a);
    this.alerts.set(a.fingerprint, a);
  }

  // notifySilenceExpired gets called whenever a silence
  async notifySilenceExpired(silenceID: string) {
    this.alerts.values().forEach((v) => {
      v.silencedBy = v.silencedBy.filter((id) => id !== silenceID);
    });
  }
}
