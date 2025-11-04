import { OpenAPIRoute } from "chanfana";
import { Context } from "hono";
import { z } from "zod";
import { GettableUserTokenSpec } from "../../types/api";
import { Errors, HTTPResponses } from "../../types/http";
import { Bindings } from "../../types/internal";
import { checkAPIKey, toErrorString } from "../utils/auth";

export class GetUserTokens extends OpenAPIRoute {
	schema = {
		operationId: "getUserTokens",
		tags: ["auth"],
		summary: "Get all the API tokens for the authenticated user",
		responses: {
			"200": {
				description: "Sucessfully retrieved silence",
				content: {
					"application/json": {
						schema: z.array(GettableUserTokenSpec).openapi({ description: "The list of API tokens for the user" }),
					},
				},
			},
			...Errors,
		},
	};

	async handle(c: Context<{ Bindings: Bindings }>) {
		const authResult = await checkAPIKey(c.env, c.req, "read-api-keys");
		if (authResult.result !== "ok") {
			c.status(HTTPResponses.Unauthorized);
			return c.text(toErrorString(authResult));
		}

		type apiKeyResult = {
			name: string;
			id: string;
			created: number;
			expires: number;
			scopes: string;
		};

		const data: D1Result<apiKeyResult> = await c.env.DB.prepare(
			`SELECT name, id, created, expires, scopes FROM api_keys WHERE user_id = ? AND account_id = ?`,
		)
			.bind(authResult.userID, authResult.accountID)
			.run();

		const results: z.infer<typeof GettableUserTokenSpec>[] = [];
		for (const row of data.results) {
			results.push({
				name: row.name,
				id: row.id,
				createdAt: new Date(row.created).toISOString(),
				expiresAt: new Date(row.expires).toISOString(),
				scopes: row.scopes.split(","),
			});
		}

		return c.json(results);
	}
}
