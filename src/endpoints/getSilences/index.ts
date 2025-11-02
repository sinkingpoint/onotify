import { OpenAPIRoute } from "chanfana";
import { Context } from "hono";
import { AccountControllerActions } from "../../dos/account-controller";
import { GetSilencesParamsSpec, GettableSilencesSpec, PaginationHeaders } from "../../types/api";
import { Errors, HTTPResponses } from "../../types/http";
import { Bindings, Silence } from "../../types/internal";
import { callRPC } from "../../utils/rpc";
import { internalSilenceToAlertmanager } from "../utils/api";
import { checkAPIKey, toErrorString } from "../utils/auth";
import { accountControllerName } from "../utils/kv";

const getFieldFromSilence = (silence: Silence, field: string) => {
	switch (field) {
		case "startsAt":
			return silence.startsAt;
		case "endsAt":
			return silence.endsAt;
		default:
			throw `Unknown field ${field}`;
	}
};

const compareStrings = (a: string, b: string, dir: "asc" | "desc") => {
	const comparison = a.localeCompare(b);
	return dir === "asc" ? comparison : -comparison;
};

export class GetSilences extends OpenAPIRoute {
	schema = {
		operationId: "getSilences",
		tags: ["silences"],
		summary: "Get a list of silences",
		request: {
			query: GetSilencesParamsSpec,
		},
		responses: {
			"200": {
				description: "Sucessfully retrieved silences",
				headers: PaginationHeaders,
				content: {
					"application/json": {
						schema: GettableSilencesSpec,
					},
				},
			},
			...Errors,
		},
	};

	async handle(c: Context<{ Bindings: Bindings }>) {
		const authResult = await checkAPIKey(c.env, c.req, "get-silences");
		if (authResult.result !== "ok") {
			c.status(HTTPResponses.Unauthorized);
			return c.text(toErrorString(authResult));
		}

		const {
			query: { id, filter, active, expired, sort, limit, page },
		} = await this.getValidatedData<typeof this.schema>();

		const controllerName = accountControllerName(authResult.accountID);
		const controllerID = c.env.ACCOUNT_CONTROLLER.idFromName(controllerName);
		const controller = c.env.ACCOUNT_CONTROLLER.get(controllerID);

		let silences = (await callRPC(controller, AccountControllerActions.GetSilences, {
			id,
			matchers: filter,
			active,
			expired,
		})) as Silence[];

		if (sort) {
			const fields = sort.map((s) => {
				const [field, direction] = s.split(":");
				return { field, direction };
			});

			silences.sort((a, b) => {
				for (const { field, direction } of fields) {
					const aValue = getFieldFromSilence(a, field);
					const bValue = getFieldFromSilence(b, field);
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

		const totalLength = silences.length;
		let startIndex = 0;
		let endIndex = silences.length;

		if (limit) {
			startIndex = limit * ((page ?? 1) - 1);
			endIndex = startIndex + limit;
		}

		c.status(200);
		c.res.headers.set("X-Total-Count", totalLength.toString());
		return c.json(silences.slice(startIndex, endIndex).map((s) => internalSilenceToAlertmanager(s)));
	}
}
