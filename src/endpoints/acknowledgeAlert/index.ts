import { OpenAPIRoute } from "chanfana";
import { Context } from "hono";
import { z } from "zod";
import { AccountControllerActions } from "../../dos/account-controller";
import { Errors, HTTPResponses } from "../../types/http";
import { Bindings } from "../../types/internal";
import { callRPC } from "../../utils/rpc";
import { checkAPIKey, toErrorString } from "../utils/auth";
import { accountControllerName } from "../utils/kv";

export class AcknowledgeAlert extends OpenAPIRoute {
	schema = {
		operationId: "acknowledgeAlert",
		tags: ["alerts"],
		summary: "Acknowledge a firing alert",
		request: {
			params: z.object({
				fingerprint: z.string().openapi({ description: "The ID of the silence to retrieve" }),
			}),
		},
		responses: {
			"200": {
				description: "Alert acknowledged successfully",
			},
			...Errors,
		},
	};

	async handle(c: Context<{ Bindings: Bindings }>) {
		const authResult = await checkAPIKey(c.env, c.req, "acknowledge-alert");
		if (authResult.result !== "ok") {
			c.status(HTTPResponses.Unauthorized);
			return c.text(toErrorString(authResult));
		}

		const { params } = await this.getValidatedData<typeof this.schema>();
		const { fingerprint } = params;
		const controllerName = accountControllerName(authResult.accountID);
		const controllerID = c.env.ACCOUNT_CONTROLLER.idFromName(controllerName);
		const controller = c.env.ACCOUNT_CONTROLLER.get(controllerID);

		// Use the account controller's acknowledgeAlert RPC
		const result: boolean | undefined = await callRPC(controller, AccountControllerActions.AcknowledgeAlert, {
			fingerprint,
			user: authResult.accountID,
		});

		if (!result) {
			c.status(HTTPResponses.BadRequest);
			return c.text("Alert cannot be acknowledged (not firing or not found)");
		}

		return c.text("Acknowledged", HTTPResponses.OK);
	}
}
