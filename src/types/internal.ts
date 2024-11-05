export interface Bindings {
  DB: D1Database;
  CONFIGS: KVNamespace;
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
