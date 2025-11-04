import { OpenAPIRoute } from "chanfana";
import { Context } from "hono";
import { AccountControllerActions } from "../../dos/account-controller";
import { PostableSilenceSpec } from "../../types/api";
import { Errors, HTTPResponses } from "../../types/http";
import { Bindings } from "../../types/internal";
import { callRPC } from "../../utils/rpc";
import { checkAPIKey, toErrorString } from "../utils/auth";
import { accountControllerName } from "../utils/kv";

export class PostSilence extends OpenAPIRoute {
	schema = {
		operationId: "postSilence",
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
				description: "Sucessfully pushed silence",
			},
			...Errors,
		},
	};

	async handle(c: Context<{ Bindings: Bindings }>) {
		const authResult = await checkAPIKey(c.env, c.req, "write-silences");
		if (authResult.result !== "ok") {
			c.status(HTTPResponses.Unauthorized);
			return c.text(toErrorString(authResult));
		}

		const data = await this.getValidatedData<typeof this.schema>();
		const controllerName = accountControllerName(authResult.accountID);
		const controllerID = c.env.ACCOUNT_CONTROLLER.idFromName(controllerName);
		const controller = c.env.ACCOUNT_CONTROLLER.get(controllerID);

		let id: string;
		try {
			id = (await callRPC(controller, AccountControllerActions.AddSilence, {
				...data.body,
				createdBy: authResult.userID,
			})) as string;
		} catch (e) {
			c.status(HTTPResponses.BadRequest);
			return c.text(e as string);
		}

		c.status(HTTPResponses.OK);
		return c.text(id);
	}
}
