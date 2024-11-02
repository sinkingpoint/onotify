import { AccountController } from "../dos/account-controller";

export interface Bindings {
  DB: D1Database;
  ACCOUNT_CONTROLLER: DurableObjectNamespace<AccountController>;
}

export interface Alert {
  fingerprint: string;
  status: "firing" | "resolved";
  startsAt: number;
  endsAt?: number;
  name: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
}
