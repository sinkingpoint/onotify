import { InhibitRule } from "types/alertmanager";
import { Matcher } from "types/api";
import { alertState, CachedAlert, ReceiveredAlert } from "types/internal";
import { matcherMatches } from "utils/matcher";
import { getAnchoredRegex } from "utils/regex";
import { CachedInhibition } from "./util";

interface InhibitionStorage {
  get: (inhibitionRuleID: string) => Promise<CachedInhibition | undefined>;
  put: (name: string, alert: CachedInhibition) => Promise<void>;
  delete: (name: string) => Promise<boolean>;
}

export class InhibitionDB {
  storage: InhibitionStorage;
  inhibitions: Map<string, CachedInhibition>;

  constructor(storage: InhibitionStorage) {
    this.storage = storage;
    this.inhibitions = new Map();
  }

  init(inhibitions: Map<string, CachedInhibition>) {
    this.inhibitions = inhibitions;
  }

  async processAlert(alert: ReceiveredAlert) {
    if(alertState(alert) === "resolved") {
      await this.removeAlert(alert);
    }

    if(alertState(alert) === "firing") {
      await this.addAlert(alert);
    }
  }

  async addAlert(alert: ReceiveredAlert) {
    for(const [key, inhibition] of this.inhibitions.entries()) {
      if(inhibitionMatches(alert, inhibition.rule.source_match, inhibition.rule.source_match_re, inhibition.rule.source_matchers)) {
        if(!inhibition.alertFingerprints.includes(alert.fingerprint)) {
          inhibition.alertFingerprints.push(alert.fingerprint);
          await this.storage.put(key, inhibition);
        }
      }
    }
  }

  async removeAlert(alert: ReceiveredAlert) {
    for(const [key, inhibition] of this.inhibitions.entries()) {
      const oldLength = inhibition.alertFingerprints.length;
      inhibition.alertFingerprints = inhibition.alertFingerprints.filter((fingerprint) => fingerprint !== alert.fingerprint);
      if(oldLength !== inhibition.alertFingerprints.length) {
        this.inhibitions.set(key, inhibition);
        await this.storage.put(key, inhibition);
      }
    }
  }

  async getAlertsThatInhibit(alert: CachedAlert) {
    const inhibitors = [];
    for(const [key, inhibition] of this.inhibitions.entries()) {
      if(inhibitionMatches(alert, inhibition.rule.target_match, inhibition.rule.target_match_re, inhibition.rule.target_matchers)) {
        inhibitors.push(...inhibition.alertFingerprints);
      }
    }

    return inhibitors;
  }
}

const inhibitionMatches = (alert: ReceiveredAlert, match?: Record<string, string>, match_re?: Record<string, string>, matchers?: Matcher[]) => {
  if(match) {
    for(const [key, value] of Object.entries(match)) {
      if((alert.labels[key] ?? "") !== value) {
        return false;
      }
    }
  }

  if(match_re) {
    for(const [key, value] of Object.entries(match_re)) {
      const regex = getAnchoredRegex(value);
      if(!regex.test(alert.labels[key] ?? "")) {
        return false;
      }
    }
  }  

  if(matchers) {
    for(const matcher of matchers) {
      if(!matcherMatches(matcher, alert.labels)) {
        return false;
      }
    }
  }

  return true;
}