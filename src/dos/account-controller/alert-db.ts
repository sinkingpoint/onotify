import {
  Alert,
  CachedAlert,
  GetAlertsOptions,
  ReceiveredAlert,
} from "../../types/internal";
import { alertIsSame } from "../../utils/alert";
import { SilenceDB } from "./silence-db";
import { alertKVKey } from "./util";

interface AlertStorage {
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

  async addAlert(a: ReceiveredAlert) {
    const cached = this.alerts.get(a.fingerprint);
    if (cached && alertIsSame(a, cached)) {
      return;
    }

    const silencedBy = cached
      ? cached.silencedBy
      : this.silenceDB.silencedBy(a);

    const inhibitedBy = cached ? cached.inhibitedBy : [];
    return this.storeAlert({
      silencedBy,
      inhibitedBy,
      updatedAt: Date.now(),
      ...a,
    });
  }

  async getAlert(fingerprint: string): Promise<CachedAlert | undefined> {
    const cached = this.alerts.get(fingerprint);
    if (cached) {
      return cached;
    }

    const loaded = await this.storage.get(alertKVKey(fingerprint));
    if (loaded) {
      this.alerts.set(fingerprint, loaded);
    }

    return loaded;
  }

  getAlerts({
    active,
    fingerprints,
    silenced,
    muted,
    inhibited,
  }: GetAlertsOptions): CachedAlert[] {
    silenced ??= true;
    inhibited ??= true;
    active ??= true;
    muted ??= true;

    return [...this.alerts.values()].filter((f) => {
      if (fingerprints && !fingerprints.includes(f.fingerprint)) {
        return false;
      }

      const isSilenced = f.silencedBy.length > 0;
      const isInhibited = f.inhibitedBy.length > 0;
      const isActive = !isSilenced && !isInhibited;
      // TODO(https://github.com/sinkingpoint/onotify/issues/3): Support muted alerts here.

      if (!silenced && isSilenced) {
        return false;
      }

      if (!inhibited && isInhibited) {
        return false;
      }

      if (!active && isActive) {
        return false;
      }

      return true;
    });
  }

  private async storeAlert(a: CachedAlert) {
    await this.storage.put(alertKVKey(a.fingerprint), a);
    this.alerts.set(a.fingerprint, a);
  }

  // notifySilenceExpired gets called whenever a silence
  async notifySilenceExpired(silenceID: string) {
    this.alerts.values().forEach((v) => {
      v.silencedBy = v.silencedBy.filter((id) => id !== silenceID);
    });
  }
}
