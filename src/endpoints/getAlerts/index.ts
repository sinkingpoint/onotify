import { OpenAPIRoute } from "chanfana";
import { Context } from "hono";
import { AccountControllerActions } from "../../dos/account-controller";
import { GetAlertsParamsSpec, GettableAlert, GettableAlertsSpec, PaginationHeaders } from "../../types/api";
import { Errors, HTTPResponses } from "../../types/http";
import { Bindings, CachedAlert } from "../../types/internal";
import { callRPC } from "../../utils/rpc";
import { checkAPIKey, toErrorString } from "../utils/auth";
import { accountControllerName } from "../utils/kv";

const getFieldFromAlert = (alert: GettableAlert, field: string) => {
	switch (field) {
		case "alertname":
			return alert.labels["alertname"];
		case "startsAt":
			return alert.startsAt;
		case "endsAt":
			return alert.endsAt;
		case "updatedAt":
			return alert.updatedAt;
		default:
			throw `Unknown field ${field}`;
	}
};

const compareStrings = (a: string, b: string, dir: "asc" | "desc") => {
	const comparison = a.localeCompare(b);
	return dir === "asc" ? comparison : -comparison;
};

export class GetAlerts extends OpenAPIRoute {
	schema = {
		operationId: "getAlerts",
		tags: ["alerts"],
		summary: "Get a list of alerts",
		request: {
			query: GetAlertsParamsSpec,
		},
		responses: {
			"200": {
				description: "Successfully got alerts",
				headers: PaginationHeaders,
				content: {
					"application/json": {
						schema: GettableAlertsSpec,
					},
				},
			},
			...Errors,
		},
	};

	async handle(c: Context<{ Bindings: Bindings }>) {
		const authResult = await checkAPIKey(c.env, c.req, "read-alerts");
		if (authResult.result !== "ok") {
			c.status(HTTPResponses.Unauthorized);
			return c.text(toErrorString(authResult));
		}

		const { query } = await this.getValidatedData<typeof this.schema>();
		const {
			fingerprints,
			active,
			silenced,
			inhibited,
			unprocessed,
			filter,
			resolved,
			muted,
			receiver,
			sort,
			limit,
			page,
		} = query;

		const controllerName = accountControllerName(authResult.accountID);
		const controllerID = c.env.ACCOUNT_CONTROLLER.idFromName(controllerName);
		const controller = c.env.ACCOUNT_CONTROLLER.get(controllerID);

		const outputAlerts: GettableAlert[] = [];
		const internalAlerts = (await callRPC(controller, AccountControllerActions.GetAlerts, {
			fingerprints,
			active,
			silenced,
			inhibited,
			unprocessed,
			resolved,
			muted,
			filter,
			receiver,
		})) as CachedAlert[];

		for (const alert of internalAlerts) {
			outputAlerts.push({
				fingerprint: alert.fingerprint,
				labels: alert.labels,
				annotations: alert.annotations,
				startsAt: new Date(alert.startsAt).toISOString(),
				endsAt: new Date(alert.endsAt ?? 0).toISOString(),
				updatedAt: new Date(alert.updatedAt).toISOString(),
				acknowledgedBy: alert.acknowledgedBy,
				receivers: alert.receivers.map((r) => {
					return {
						name: r,
					};
				}),
				status: {
					silencedBy: alert.silencedBy,
					inhibitedBy: alert.inhibitedBy,
					state: alert.silencedBy.length > 0 || alert.inhibitedBy.length > 0 ? "supressed" : "active",
				},
			});
		}

		// This accumulates the alerts, and then sorts them based on the sort. An insertion sort _while_ we're accumulating
		// would probably be more efficient, but this is simpler for now - something to benchmark in the future though.
		if (sort) {
			const fields = sort.map((s) => {
				const [field, direction] = s.split(":");
				return { field, direction };
			});

			outputAlerts.sort((a, b) => {
				for (const { field, direction } of fields) {
					const aValue = getFieldFromAlert(a, field);
					const bValue = getFieldFromAlert(b, field);
					if (typeof aValue === "string" && typeof bValue === "string") {
						return compareStrings(aValue, bValue, direction as "asc" | "desc");
					} else {
						if (aValue < bValue) {
							return direction === "asc" ? -1 : 1;
						}

						if (aValue > bValue) {
							return direction === "asc" ? 1 : -1;
						}
					}
				}

				return 0;
			});
		}

		const totalLength = outputAlerts.length;
		let startIndex = 0;
		let endIndex = outputAlerts.length;

		if (limit) {
			startIndex = limit * ((page ?? 1) - 1);
			endIndex = startIndex + limit;
		}
		c.res.headers.set("X-Total-Count", totalLength.toString());
		return c.json(outputAlerts.slice(startIndex, endIndex), HTTPResponses.OK);
	}
}
