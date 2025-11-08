import { OpenAPIRoute } from "chanfana";
import { Context } from "hono";
import { z } from "zod";
import { GettableUser, GettableUserSpec } from "../../types/api";
import { Errors, HTTPResponses } from "../../types/http";
import { Bindings } from "../../types/internal";
import { checkAPIKey, toErrorString } from "../utils/auth";

export class GetAccountUsers extends OpenAPIRoute {
	schema = {
		operationId: "getAccountUsers",
		tags: ["auth"],
		summary: "Get all users for the account",
		responses: {
			"200": {
				description: "Sucessfully retrieved users",
				content: {
					"application/json": {
						schema: z.array(GettableUserSpec),
					},
				},
			},
			...Errors,
		},
	};

	async handle(c: Context<{ Bindings: Bindings }>) {
		const authResult = await checkAPIKey(c.env, c.req, "read-users");
		if (authResult.result !== "ok") {
			c.status(HTTPResponses.Unauthorized);
			return c.text(toErrorString(authResult));
		}

		const usersResult = await c.env.DB.prepare(`select user_id, scopes from account_membership where account_id = ?`)
			.bind(authResult.accountID)
			.all<{ user_id: string; scopes: string }>();

		if (usersResult.error) {
			c.status(HTTPResponses.InternalServerError);
			return c.json({ error: "failed to fetch users" });
		}

		const userIds = usersResult.results.map((r) => r.user_id);

		if (userIds.length === 0) {
			return c.json([]);
		}

		const placeholders = userIds.map(() => "?").join(",");
		const userQuery = await c.env.DB.prepare(`select id, name, email from user where id IN (${placeholders})`)
			.bind(...userIds)
			.all<{
				id: string;
				name: string;
				email: string;
			}>();

		if (userQuery.error) {
			c.status(HTTPResponses.InternalServerError);
			return c.json({ error: "failed to fetch user details" });
		}

		const users: GettableUser[] = [];
		for (const user of userQuery.results) {
			users.push({
				id: user.id,
				name: user.name,
				email: user.email,
				scopes: usersResult.results.find((u) => u.user_id === user.id)?.scopes.split(",") || [],
			});
		}

		return c.json(users);
	}
}
