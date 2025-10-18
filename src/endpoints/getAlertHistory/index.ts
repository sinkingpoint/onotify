import { OpenAPIRoute } from "chanfana";
import { Context } from "hono";
import z from "zod";
import { AccountControllerActions } from "../../dos/account-controller";
import {
	GetAlertHistoryParamsSpec,
	GettableAlertHistory,
	GettableAlertHistorySpec,
	PaginationHeaders,
} from "../../types/api";
import { Errors, HTTPResponses } from "../../types/http";
import { Bindings, CachedAlert } from "../../types/internal";
import { callRPC } from "../../utils/rpc";
import { checkAPIKey, toErrorString } from "../utils/auth";
import { accountControllerName } from "../utils/kv";

export class GetAlertHistory extends OpenAPIRoute {
	schema = {
		operationId: "getAlertHistory",
		tags: ["alerts"],
		summary: "Get a list of history events for an alert",
		request: {
			params: z.object({
				fingerprint: z.string().openapi({ description: "The fingerprint of the alert to get history for" }),
			}),
			query: GetAlertHistoryParamsSpec,
		},
		responses: {
			"200": {
				description: "Successfully got alerts",
				headers: PaginationHeaders,
				content: {
					"application/json": {
						schema: z.array(GettableAlertHistorySpec),
					},
				},
			},
			...Errors,
		},
	};

	async handle(c: Context<{ Bindings: Bindings }>) {
		const authResult = await checkAPIKey(c.env, c.req.header("Authorization"), "get-alerts");
		if (authResult.result !== "ok") {
			c.status(HTTPResponses.Unauthorized);
			return c.text(toErrorString(authResult));
		}

		const { query, params } = await this.getValidatedData<typeof this.schema>();
		const { startTime, endTime, page, pageSize } = query;
		const { fingerprint } = params;

		const controllerName = accountControllerName(authResult.accountID);
		const controllerID = c.env.ACCOUNT_CONTROLLER.idFromName(controllerName);
		const controller = c.env.ACCOUNT_CONTROLLER.get(controllerID);

		const internalAlerts = (await callRPC(controller, AccountControllerActions.GetAlerts, {
			fingerprints: [fingerprint],
		})) as CachedAlert[];

		if (internalAlerts.length === 0) {
			c.status(HTTPResponses.NotFound);
			return c.text("No alerts found");
		}

		const alert = internalAlerts[0];
		let history = alert.history;
		if (startTime) {
			history = history.filter((h) => h.timestamp >= startTime);
		}
		if (endTime) {
			history = history.filter((h) => h.timestamp <= endTime);
		}

		const totalLength = history.length;
		let start = 0;
		let end = history.length;
		if (pageSize) {
			start = pageSize * (page ?? 0);
			end = start + pageSize;
			if (start > history.length) {
				start = history.length - 1;
			}

			if (end > history.length) {
				end = history.length;
			}
		}

		const outputHistories: GettableAlertHistory[] = history.slice(start, end).map((h) => {
			if (h.ty === "comment") {
				return {
					ty: h.ty,
					timestamp: new Date(h.timestamp).toISOString(),
					comment: h.comment,
					userID: h.userID,
				};
			} else {
				return {
					ty: h.ty,
					timestamp: new Date(h.timestamp).toISOString(),
				};
			}
		});

		c.res.headers.set("X-Total-Count", history.length.toString());
		c.status(HTTPResponses.OK);
		return c.json(outputHistories);
	}
}
