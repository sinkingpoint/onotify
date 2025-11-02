import { OpenAPIRoute } from "chanfana";
import { Context } from "hono";
import { PostableRequiredFileSpec } from "../../types/api";
import { Errors, HTTPResponses } from "../../types/http";
import { Bindings } from "../../types/internal";
import { checkAPIKey, toErrorString } from "../utils/auth";
import { uploadedFilesKey } from "../utils/kv";

export class PostRequiredFiles extends OpenAPIRoute {
	schema = {
		operationId: "postRequiredFiles",
		tags: ["config"],
		summary: "Upload an extra file required by the alertmanager spec",
		request: {
			body: {
				content: {
					"application/json": {
						schema: PostableRequiredFileSpec,
					},
				},
			},
		},
		responses: {
			"200": {
				description: "Successfully uploaded file",
			},
			...Errors,
		},
	};

	async handle(c: Context<{ Bindings: Bindings }>) {
		const authResult = await checkAPIKey(c.env, c.req, "upload-config");

		if (authResult.result !== "ok") {
			c.status(HTTPResponses.Unauthorized);
			return c.text(toErrorString(authResult));
		}

		const { accountID } = authResult;
		const { body: config } = await this.getValidatedData<typeof this.schema>();

		const kvKey = `${uploadedFilesKey(accountID)}-${config.path}`;
		await c.env.CONFIGS.put(kvKey, config.contents);

		c.status(HTTPResponses.OK);
		return c.text(`successfully uploaded ${config.path}`);
	}
}
