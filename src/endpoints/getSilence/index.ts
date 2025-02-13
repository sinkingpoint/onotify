import { OpenAPIRoute } from "chanfana";
import { Context } from "hono";
import { z } from "zod";
import { GettableSilenceSpec } from "../../types/api";
import { Errors, HTTPResponses } from "../../types/http";
import { Bindings } from "../../types/internal";
import { internalSilenceToAlertmanager } from "../utils/api";
import { checkAPIKey, toErrorString } from "../utils/auth";
import { accountControllerName } from "../utils/kv";

export default class GetSilence extends OpenAPIRoute {
	schema = {
		operationId: "getSilence",
		tags: ["silences"],
		summary: "Get a silence by ID",
		request: {
			params: z.object({
				id: z.string().openapi({ description: "The ID of the silence to retrieve" }),
			}),
		},
		responses: {
			"200": {
				description: "Sucessfully retrieved silence",
				content: {
					"application/json": {
						schema: GettableSilenceSpec,
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

		const data = await this.getValidatedData<typeof this.schema>();
		const controllerName = accountControllerName(authResult.accountID);
		const controllerID = c.env.ACCOUNT_CONTROLLER.idFromName(controllerName);
		const controller = c.env.ACCOUNT_CONTROLLER.get(controllerID);

		const silence = await controller.getSilence(data.params.id);
		if (!silence) {
			c.status(HTTPResponses.NotFound);
			return c.text("Silence not found");
		}

		c.status(200);
		return c.json(internalSilenceToAlertmanager(silence));
	}
}
