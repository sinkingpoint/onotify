import { OpenAPIRoute } from "chanfana";
import { Context } from "hono";
import { z } from "zod";
import { Errors, HTTPResponses } from "../../types/http";
import { Bindings } from "../../types/internal";
import { checkAPIKey, hashPassword, toErrorString } from "../utils/auth";

export class PostAPIKey extends OpenAPIRoute {
	schema = {
		operationId: "postAPIKey",
		tags: ["auth"],
		summary: "Create a new API key for the authenticated user",
		request: {
			body: {
				content: {
					"application/json": {
						schema: z.object({
							name: z.string().min(1).max(100).openapi({
								description: "Name for the API key",
								example: "My API Key",
							}),
							scopes: z.array(z.string()).openapi({
								description: "List of scopes for the API key",
								example: ["read", "write"],
							}),
							expiresInDays: z.number().int().min(1).max(365).optional().openapi({
								description: "Number of days until the key expires (optional)",
								example: 30,
							}),
						}),
					},
				},
			},
		},
		responses: {
			"201": {
				description: "Successfully created API key",
				content: {
					"application/json": {
						schema: z.object({
							id: z.string(),
							name: z.string(),
							key: z.string(),
							scopes: z.array(z.string()),
							createdAt: z.number(),
							expiresAt: z.number().nullable(),
						}),
					},
				},
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
		const { name, scopes, expiresInDays } = data.body;

		// Get user's current scopes
		const userScopes = await getUserScopes(c.env, authResult.userID, authResult.accountID);
		if (!userScopes) {
			c.status(HTTPResponses.Forbidden);
			return c.text("Unable to retrieve user scopes");
		}

		if (!doScopesOverlap(userScopes, scopes)) {
			c.status(HTTPResponses.Forbidden);
			return c.text("Requested scopes exceed user's permissions");
		}

		// Generate secure API key
		const apiKey = Array.from(crypto.getRandomValues(new Uint8Array(16)))
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");

		const keyId = apiKey.slice(-8); // The last 8 characters of the key as its ID
		const keyHash = await hashPassword(apiKey, new Uint8Array());

		const createdAt = Date.now();
		const expiresAt = expiresInDays ? createdAt + expiresInDays * 24 * 60 * 60 * 1000 : 0;

		// Insert the new API key
		const result = await c.env.DB.prepare(
			`INSERT INTO api_keys (user_id, account_id, name, id, key, created, expires, scopes)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		)
			.bind(authResult.userID, authResult.accountID, name, keyId, keyHash, createdAt, expiresAt, scopes.join(","))
			.run();

		if (!result.success) {
			c.status(HTTPResponses.InternalServerError);
			return c.text("Failed to create API key");
		}

		c.status(HTTPResponses.Created);
		return c.json({
			id: keyId,
			name,
			key: `notify-${apiKey}`,
			scopes,
			createdAt,
			expiresAt: expiresAt || null,
		});
	}
}

const getUserScopes = async (env: Bindings, userID: string, accountID: string): Promise<string[] | null> => {
	const userScopes = await env.DB.prepare(`SELECT scopes FROM account_membership WHERE user_id = ? AND account_id = ?`)
		.bind(userID, accountID)
		.first<{ scopes: string }>();

	if (!userScopes) {
		return null;
	}

	return userScopes.scopes === "*" ? ["*"] : userScopes.scopes.split(",");
};

const doScopesOverlap = (userScopes: string[], requestedScopes: string[]): boolean => {
	if (userScopes.includes("*")) {
		return true;
	}

	return requestedScopes.some((scope) => userScopes.includes(scope));
};
