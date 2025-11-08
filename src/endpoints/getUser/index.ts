import { OpenAPIRoute } from "chanfana";
import { Context } from "hono";
import { GettableUserSpec, GetUserParamsSpec } from "../../types/api";
import { Errors, HTTPResponses } from "../../types/http";
import { Bindings } from "../../types/internal";
import { checkAPIKey, getUserInfo, toErrorString } from "../utils/auth";

// The user ID for the currently authenticated user, used to fetch their details.
const ME_USER_ID = "me";

export class GetUser extends OpenAPIRoute {
	schema = {
		operationId: "getUser",
		tags: ["auth"],
		summary: "get the details about a user",
		request: {
			params: GetUserParamsSpec,
		},
		responses: {
			"200": {
				description: "Returned user details",
				content: {
					"application/json": {
						schema: GettableUserSpec.openapi({ description: "The details about the user" }),
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

		let {
			params: { userID },
		} = await this.getValidatedData<typeof this.schema>();

		if (userID === ME_USER_ID) {
			userID = authResult.userID;
		}

		const userInfo = await getUserInfo(c.env, userID, authResult.accountID);
		if (userInfo.result === "not found") {
			c.status(HTTPResponses.NotFound);
			return c.text("User not found");
		}

		c.status(HTTPResponses.OK);
		return c.json({
			user: userInfo.user,
		});
	}
}
