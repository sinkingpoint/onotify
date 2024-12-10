import { CachedAlert } from "../../types/internal";

export const internalAlertToAlertmanager = (a: CachedAlert) => {
  return {
    ...a,
    startsAt: new Date(a.startsAt).toISOString(),
    endsAt: a.endsAt ? new Date(a.endsAt).toISOString() : undefined,
    updatedAt: a.updatedAt ? new Date(a.updatedAt).toISOString() : undefined,
    status: {
      state:
        a.silencedBy.length > 0 || a.inhibitedBy.length > 0
          ? "supressed"
          : "active",
      silencedBy: a.silencedBy,
      inhibitedBy: a.inhibitedBy,
      mutedBy: [], // TODO
    },
    receivers: a.receivers.map((r) => {
      return {
        name: r,
      };
    }),
  };
};
