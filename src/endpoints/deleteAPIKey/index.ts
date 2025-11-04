import { OpenAPIRoute } from "chanfana";
import { Context } from "hono";
import { z } from "zod";
import { Errors, HTTPResponses } from "../../types/http";
import { Bindings } from "../../types/internal";
import { checkAPIKey, toErrorString } from "../utils/auth";

export class DeleteAPIKey extends OpenAPIRoute {
	schema = {
		operationId: "deleteAPIKey",
		tags: ["auth"],
		summary: "Delete an API key for the authenticated user",
		request: {
			params: z.object({
				tokenId: z.string().openapi({
					description: "The ID of the API key to delete",
				}),
			}),
		},
		responses: {
			"200": {
				description: "Successfully deleted API token",
			},
			...Errors,
		},
	};

	async handle(c: Context<{ Bindings: Bindings }>) {
		const authResult = await checkAPIKey(c.env, c.req, "write-api-keys");
		if (authResult.result !== "ok") {
			c.status(HTTPResponses.Unauthorized);
			return c.text(toErrorString(authResult));
		}

		const data = await this.getValidatedData<typeof this.schema>();
		const result = await c.env.DB.prepare(
			`
      DELETE FROM api_keys
      WHERE id = ? AND user_id = ? AND account_id = ?
    `,
		)
			.bind(data.params.tokenId, authResult.userID, authResult.accountID)
			.run();

		if (result.meta.changes === 0) {
			c.status(HTTPResponses.NotFound);
			return c.text("API key not found");
		}

		c.status(HTTPResponses.OK);
		return c.text("API key deleted successfully");
	}
}
