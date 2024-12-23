import { OpenAPIRoute } from "chanfana";
import { PostableSilenceSpec } from "../../types/api";
import { Errors, HTTPResponses } from "../../types/http";
import { Bindings } from "../../types/internal";
import { Context } from "hono";
import { checkAPIKey, toErrorString } from "../utils/auth";
import { accountControllerName } from "../utils/kv";

export class PostSilence extends OpenAPIRoute {
	schema = {
		tags: ["silences"],
		summary: "Add silences to the system",
		request: {
			body: {
				content: {
					"application/json": {
						schema: PostableSilenceSpec,
					},
				},
			},
		},
		responses: {
			"200": {
				description: "Sucessfully pushed silences",
			},
			...Errors,
		},
	};

	async handle(c: Context<{ Bindings: Bindings }>) {
		const authResult = await checkAPIKey(c.env, c.req.header("Authorization"), "post-silences");
		if (authResult.result !== "ok") {
			c.status(HTTPResponses.Unauthorized);
			return c.text(toErrorString(authResult));
		}

		const data = await this.getValidatedData<typeof this.schema>();
		const controllerName = accountControllerName(authResult.accountID);
		const controllerID = c.env.ACCOUNT_CONTROLLER.idFromName(controllerName);
		const controller = c.env.ACCOUNT_CONTROLLER.get(controllerID);

		c.status(HTTPResponses.OK);
		return c.text("ok");
	}
}
