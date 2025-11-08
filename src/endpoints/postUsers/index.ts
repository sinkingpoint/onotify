import { OpenAPIRoute } from "chanfana";
import { Context } from "hono";
import { PostableUserSpec } from "../../types/api";
import { Errors, HTTPResponses } from "../../types/http";
import { Bindings } from "../../types/internal";
import { checkAPIKey, toErrorString } from "../utils/auth";

export class PostUsers extends OpenAPIRoute {
	schema = {
		operationId: "postUsers",
		tags: ["auth"],
		summary: "Add a user to the system",
		request: {
			body: {
				content: {
					"application/json": {
						schema: PostableUserSpec,
					},
				},
			},
		},
		responses: {
			"200": {
				description: "Sucessfully added user to account",
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
		const { email, scopes } = data.body;

		let userId = await c.env.DB.prepare(`select id from user where email = ?`).bind(email).first();
		if (!userId) {
			const newUserId = crypto.randomUUID();
			const insertUser = await c.env.DB.prepare(`insert into user (id, name, email) values (?, ?, ?)`)
				.bind(newUserId, email.split("@")[0], email)
				.run();
			if (insertUser.error) {
				c.status(HTTPResponses.InternalServerError);
				return c.json({ error: "failed to create user" });
			}

			userId = { id: newUserId };
		}

		const insertMembership = await c.env.DB.prepare(
			`insert or replace into account_membership (user_id, account_id, scopes) values (?, ?, ?)`,
		)
			.bind(userId.id, authResult.accountID, scopes.join(","))
			.run();
		if (insertMembership.error) {
			c.status(HTTPResponses.InternalServerError);
			return c.json({ error: "failed to add user to account" });
		}

		c.status(HTTPResponses.OK);
		return c.json({ message: "User added to account successfully" });
	}
}
