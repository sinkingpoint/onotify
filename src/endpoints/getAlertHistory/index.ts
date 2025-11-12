import { OpenAPIRoute } from "chanfana";
import { Context } from "hono";
import z from "zod";
import { AccountControllerActions } from "../../dos/account-controller";
import {
	GetAlertsParamsSpec,
	GettableAlertHistory,
	GettableAlertHistorySpec,
	PaginationHeaders,
} from "../../types/api";
import { Errors, HTTPResponses } from "../../types/http";
import { Bindings } from "../../types/internal";
import { callRPC } from "../../utils/rpc";
import { checkAPIKey, toErrorString } from "../utils/auth";
import { accountControllerName } from "../utils/kv";

export class GetAlertHistory extends OpenAPIRoute {
	schema = {
		operationId: "getAlertHistory",
		tags: ["alerts"],
		summary: "Get a list of history events for alerts",
		request: {
			query: GetAlertsParamsSpec,
		},
		responses: {
			"200": {
				description: "Successfully got alert history",
				headers: PaginationHeaders,
				content: {
					"application/json": {
						schema: z.object({
							stats: z.record(z.number()),
							entries: z.array(GettableAlertHistorySpec),
						}),
					},
					"text/csv": {
						schema: z.string().describe("CSV formatted alert history"),
					},
					"application/pdf": {
						schema: z.string().describe("PDF formatted alert history"),
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
			startTime,
			endTime,
			page,
			limit,
			active,
			silenced,
			inhibited,
			muted,
			resolved,
			unprocessed,
			receiver,
			filter,
			fingerprints,
		} = query;

		const controllerName = accountControllerName(authResult.accountID);
		const controllerID = c.env.ACCOUNT_CONTROLLER.idFromName(controllerName);
		const controller = c.env.ACCOUNT_CONTROLLER.get(controllerID);

		const historyResults = (await callRPC(controller, AccountControllerActions.GetAlertHistory, {
			fingerprints,
			startTime,
			endTime,
			active,
			silenced,
			inhibited,
			muted,
			resolved,
			unprocessed,
			receiver,
			filter,
		})) as Array<{ fingerprint: string; alertname?: string; history: any[] }>;

		if (historyResults.length === 0) {
			c.status(HTTPResponses.NotFound);
			return c.text("No alerts found");
		}

		const results = [];
		const stats: Record<string, number> = {};

		for (const alertHistory of historyResults) {
			const history = alertHistory.history;
			for (const event of history) {
				const day = new Date(event.timestamp).toISOString().split("T")[0];
				if (!stats[day]) {
					stats[day] = 0;
				}

				stats[day]++;
			}

			const outputHistories = history.map((h) => {
				if (h.ty === "comment") {
					return {
						fingerprint: alertHistory.fingerprint,
						ty: h.ty,
						timestamp: h.timestamp,
						comment: h.comment,
						userID: h.userID,
					};
				} else {
					return {
						fingerprint: alertHistory.fingerprint,
						ty: h.ty,
						timestamp: h.timestamp,
					};
				}
			});

			results.push(...outputHistories);
		}

		results.sort((a, b) => b.timestamp - a.timestamp);

		const totalLength = results.length;
		let startIndex = 0;
		let endIndex = results.length;
		if (limit) {
			startIndex = limit * ((page ?? 1) - 1);
			endIndex = startIndex + limit;
		}

		c.res.headers.set("X-Total-Count", totalLength.toString());
		c.status(HTTPResponses.OK);

		if (c.req.header("Accept") === "text/csv") {
			const csv = convertToCSV(results.slice(startIndex, endIndex));
			return c.text(csv);
		} else {
			return c.json({
				stats,
				entries: results.slice(startIndex, endIndex).map((h) => {
					return {
						...h,
						timestamp: new Date(h.timestamp).toISOString(),
					};
				}),
			});
		}
	}
}

const convertToCSV = (data: GettableAlertHistory[]): string => {
	let csv = "fingerprint,ty,timestamp,comment,userID\n";
	for (const h of data) {
		const row = [h.fingerprint, h.ty, h.timestamp];
		if (h.ty === "comment") {
			row.push(`"${h.comment.replace(/"/g, '""')}"`, h.userID ?? "");
		} else {
			row.push("", "");
		}
		csv += row.join(",") + "\n";
	}
	return csv;
};
