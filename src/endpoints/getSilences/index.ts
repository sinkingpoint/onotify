import { OpenAPIRoute } from "chanfana";
import { Context } from "hono";
import { GettableSilencesSpec } from "../../types/api";
import { Errors, HTTPResponses } from "../../types/http";
import { Bindings } from "../../types/internal";
import { internalSilenceToAlertmanager } from "../utils/api";
import { checkAPIKey, toErrorString } from "../utils/auth";
import { accountControllerName } from "../utils/kv";

export class GetSilences extends OpenAPIRoute {
	schema = {
		operationId: "getSilences",
		tags: ["silences"],
		summary: "Get a list of silences",
		request: {
			// TODO (https://github.com/sinkingpoint/onotify/issues/2): Support matchers here.
		},
		responses: {
			"200": {
				description: "Sucessfully retrieved silences",
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

		const controllerName = accountControllerName(authResult.accountID);
		const controllerID = c.env.ACCOUNT_CONTROLLER.idFromName(controllerName);
		const controller = c.env.ACCOUNT_CONTROLLER.get(controllerID);

		const silences = await controller.getSilences([]);

		c.status(200);
		return c.json(silences.map((s) => internalSilenceToAlertmanager(s)));
	}
}
