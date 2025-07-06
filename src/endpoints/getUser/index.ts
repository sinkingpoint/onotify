import { OpenAPIRoute } from "chanfana";
import { Context } from "hono";
import { z } from "zod";
import { GetUserParamsSpec } from "../../types/api";
import { Errors, HTTPResponses } from "../../types/http";
import { Bindings } from "../../types/internal";
import { checkAPIKey, getUserInfo, toErrorString } from "../utils/auth";

// The user ID for the currently authenticated user, used to fetch their details.
const ME_USER_ID = "me";

export class GetUser extends OpenAPIRoute {
	schema = {
		operationId: "getUser",
		tags: ["alerts"],
		summary: "get the details about a user",
		request: {
			params: GetUserParamsSpec,
		},
		responses: {
			"200": {
				description: "Returned user details",
				content: {
					"application/json": {
						schema: z.object({
							user: z.object({
								id: z.string(),
								name: z.string(),
							}),
						}),
					},
				},
			},
			...Errors,
		},
	};

	async handle(c: Context<{ Bindings: Bindings }>) {
		const authResult = await checkAPIKey(c.env, c.req.header("Authorization"), "acknowledge-alert");
		if (authResult.result !== "ok") {
			c.status(HTTPResponses.Unauthorized);
			return c.text(toErrorString(authResult));
		}

		const { params } = await this.getValidatedData<typeof this.schema>();
		let { userID } = params;
		if (!userID) {
			c.status(HTTPResponses.BadRequest);
			return c.text("User ID is required");
		}

		if (userID === ME_USER_ID) {
			userID = authResult.userID;
		}

		const userInfo = await getUserInfo(c.env, authResult, userID);
		if (userInfo.result === "unauthorized" || userInfo.result === "not found") {
			c.status(HTTPResponses.Unauthorized);
			return c.text("You are not authorized to access this user");
		} else if (userInfo.result === "internal error") {
			c.status(HTTPResponses.InternalServerError);
			return c.text("Internal server error while fetching user info");
		}

		if (userInfo.result !== "ok") {
			throw new Error("Unexpected result from getUserInfo: " + userInfo.result);
		}

		c.status(HTTPResponses.OK);
		return c.json({
			user: userInfo.user,
		});
	}
}
