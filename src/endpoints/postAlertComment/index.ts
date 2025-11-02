import { OpenAPIRoute } from "chanfana";
import { Context } from "hono";
import { z } from "zod";
import { AccountControllerActions } from "../../dos/account-controller";
import { Errors, HTTPResponses } from "../../types/http";
import { Bindings } from "../../types/internal";
import { callRPC } from "../../utils/rpc";
import { checkAPIKey, toErrorString } from "../utils/auth";
import { accountControllerName } from "../utils/kv";

export class PostAlertComment extends OpenAPIRoute {
	schema = {
		operationId: "postAlertComment",
		tags: ["alerts"],
		summary: "Add a comment to an alert",
		request: {
			params: z.object({
				fingerprint: z.string().min(1).max(100).openapi({ description: "The fingerprint of the alert to comment on" }),
			}),
			body: {
				content: {
					"application/json": {
						schema: z.object({
							comment: z.string().min(1).max(500).openapi({ description: "The comment to add to the alert" }),
						}),
					},
				},
			},
		},
		responses: {
			"200": {
				description: "Sucessfully pushed alerts",
			},
			...Errors,
		},
	};

	async handle(c: Context<{ Bindings: Bindings }>) {
		const authResult = await checkAPIKey(c.env, c.req, "post-alert-comment");
		if (authResult.result !== "ok") {
			c.status(HTTPResponses.Unauthorized);
			return c.text(toErrorString(authResult));
		}

		const data = await this.getValidatedData<typeof this.schema>();
		const controllerName = accountControllerName(authResult.accountID);
		const controllerID = c.env.ACCOUNT_CONTROLLER.idFromName(controllerName);
		const controller = c.env.ACCOUNT_CONTROLLER.get(controllerID);
		const success = await callRPC(controller, AccountControllerActions.AddComment, {
			fingerprint: data.params.fingerprint,
			comment: data.body.comment,
			user: authResult.userID,
		});

		if (!success) {
			c.status(HTTPResponses.NotFound);
			return c.text("Alert not found");
		}

		c.status(HTTPResponses.OK);
		return c.text("Comment added successfully");
	}
}
