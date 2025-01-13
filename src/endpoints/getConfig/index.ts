import { OpenAPIRoute } from "chanfana";
import { Context } from "hono";
import { AlertmanagerConfigSpec } from "../../types/alertmanager";
import { Errors, HTTPResponses } from "../../types/http";
import { Bindings } from "../../types/internal";
import { checkAPIKey, toErrorString } from "../utils/auth";
import { reconstituteConfig } from "./config";

export class GetConfig extends OpenAPIRoute {
	schema = {
		operationId: "getConfig",
		tags: ["config"],
		summary: "Get an uploaded alertmanager config",
		request: {},
		responses: {
			"200": {
				description: "Sucessfully got config",
				content: {
					"application/json": {
						schema: AlertmanagerConfigSpec,
					},
				},
			},
			...Errors,
		},
	};

	async handle(c: Context<{ Bindings: Bindings }>) {
		const authResult = await checkAPIKey(c.env, c.req.header("Authorization"), "get-config");

		if (authResult.result !== "ok") {
			c.status(HTTPResponses.Unauthorized);
			return c.text(toErrorString(authResult));
		}

		const { accountID } = authResult;
		const config = await reconstituteConfig(c, accountID);
		if (!config) {
			c.status(HTTPResponses.NotFound);
			return c.json({ error: "no config uploaded" });
		}

		c.status(HTTPResponses.OK);
		return c.json(config);
	}
}
