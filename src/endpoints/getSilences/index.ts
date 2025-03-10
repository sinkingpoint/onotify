import { OpenAPIRoute } from "chanfana";
import { Context } from "hono";
import { GetSilencesParamsSpec, GettableSilencesSpec, PaginationHeaders } from "../../types/api";
import { Errors, HTTPResponses } from "../../types/http";
import { Bindings, Silence } from "../../types/internal";
import { internalSilenceToAlertmanager } from "../utils/api";
import { checkAPIKey, toErrorString } from "../utils/auth";
import { accountControllerName } from "../utils/kv";

const DEFAULT_PAGE_SIZE = 20;

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
		const authResult = await checkAPIKey(c.env, c.req.header("Authorization"), "get-silences");
		if (authResult.result !== "ok") {
			c.status(HTTPResponses.Unauthorized);
			return c.text(toErrorString(authResult));
		}

		const {
			query: { matcher, active, expired, sort, limit, page },
		} = await this.getValidatedData<typeof this.schema>();
		const pageSize = limit ?? DEFAULT_PAGE_SIZE;

		const controllerName = accountControllerName(authResult.accountID);
		const controllerID = c.env.ACCOUNT_CONTROLLER.idFromName(controllerName);
		const controller = c.env.ACCOUNT_CONTROLLER.get(controllerID);

		const silences = await controller.getSilences({ matchers: matcher, active, expired });
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

		// TODO(https://github.com/sinkingpoint/onotify/issues/12): Maybe store a cursor in a DO to avoid having to sort on every search.
		let startIndex = 0;
		let endIndex = silences.length;
		if (page) {
			startIndex = pageSize * (page - 1);
			endIndex = startIndex + pageSize;
		}

		c.status(200);
		c.res.headers.set("X-Total-Count", totalLength.toString());
		return c.json(silences.slice(startIndex, endIndex).map((s) => internalSilenceToAlertmanager(s)));
	}
}
