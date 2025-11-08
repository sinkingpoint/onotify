import { OpenAPIRoute } from "chanfana";
import { Context } from "hono";
import { z } from "zod";
import { Errors, HTTPResponses } from "../../types/http";
import { Bindings } from "../../types/internal";
import { checkAPIKey, toErrorString } from "../utils/auth";

export class DeleteUsers extends OpenAPIRoute {
	schema = {
		operationId: "deleteUsers",
		tags: ["auth"],
		summary: "Delete a user from the system",
		request: {
			body: {
				content: {
					"application/json": {
						schema: z.object({
							userID: z.string(),
						}),
					},
				},
			},
		},
		responses: {
			"200": {
				description: "Successfully deleted user from account",
			},
			...Errors,
		},
	};

	async handle(c: Context<{ Bindings: Bindings }>) {
		const authResult = await checkAPIKey(c.env, c.req, "write-users");
		if (authResult.result !== "ok") {
			c.status(HTTPResponses.Unauthorized);
			return c.text(toErrorString(authResult));
		}

		const data = await this.getValidatedData<typeof this.schema>();
		const { userID } = data.body;

		const deleteMembership = await c.env.DB.prepare(
			`delete from account_membership where user_id = ? and account_id = ?`,
		)
			.bind(userID, authResult.accountID)
			.run();
		if (deleteMembership.error) {
			c.status(HTTPResponses.InternalServerError);
			return c.json({ error: "failed to delete user membership" });
		}

		c.status(HTTPResponses.OK);
		return c.json({ message: "user deleted successfully" });
	}
}
