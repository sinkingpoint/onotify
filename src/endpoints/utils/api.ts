import { CachedAlert, Silence } from "../../types/internal";

export const internalAlertToAlertmanager = (a: CachedAlert) => {
	return {
		...a,
		startsAt: new Date(a.startsAt).toISOString(),
		endsAt: a.endsAt ? new Date(a.endsAt).toISOString() : undefined,
		updatedAt: a.updatedAt ? new Date(a.updatedAt).toISOString() : undefined,
		status: {
			state: a.silencedBy.length > 0 || a.inhibitedBy.length > 0 ? "supressed" : "active",
			silencedBy: a.silencedBy,
			inhibitedBy: a.inhibitedBy,
			mutedBy: [], // TODO
		},
		history: a.history,
		receivers: a.receivers.map((r) => {
			return {
				name: r,
			};
		}),
	};
};

export const internalSilenceToAlertmanager = (s: Silence) => {
	const silenceStatus = (startsAt: number, endsAt: number) => {
		const now = Date.now();
		if (now < startsAt) {
			return "pending";
		}
		if (now > endsAt) {
			return "expired";
		}
		return "active";
	};

	return {
		id: s.id,
		matchers: s.matchers,
		startsAt: new Date(s.startsAt).toISOString(),
		endsAt: s.endsAt ? new Date(s.endsAt).toISOString() : undefined,
		updatedAt: new Date(s.updatedAt).toISOString(),
		createdBy: s.createdBy?.toString() ?? "",
		comment: s.comment ?? "",
		status: {
			state: silenceStatus(s.startsAt, s.endsAt ? s.endsAt : Infinity),
		},
	};
};
