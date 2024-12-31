import { OpenAPIRoute } from "chanfana";
import { Context } from "hono";
import { RequiredFile, RequiredFiles, RequiredFilesSpec } from "../../types/api";
import { Errors, HTTPResponses } from "../../types/http";
import { Bindings } from "../../types/internal";
import { checkAPIKey, toErrorString } from "../utils/auth";
import { requiredFilesKey, uploadedFilesKey } from "../utils/kv";

export class GetRequiredFiles extends OpenAPIRoute {
	schema = {
		tags: ["config"],
		summary: "Get config files that are in the config, but haven't been uploaded yet",
		request: {},
		responses: {
			"200": {
				description: "Sucessfully retrieved files",
				content: {
					"application/json": {
						schema: RequiredFilesSpec,
					},
				},
			},
			...Errors,
		},
	};

	async handle(c: Context<{ Bindings: Bindings }>) {
		const authResult = await checkAPIKey(c.env, c.req.header("Authorization"), "upload-config");

		if (authResult.result !== "ok") {
			c.status(HTTPResponses.Unauthorized);
			return c.text(toErrorString(authResult));
		}

		const { accountID } = authResult;

		const rawRequiredFiles = await c.env.CONFIGS.get(requiredFilesKey(accountID));
		const alreadyUploadedFiles = [...(await c.env.CONFIGS.list({ prefix: uploadedFilesKey(accountID) })).keys].map(
			(k) => k.name
		);

		if (!rawRequiredFiles) {
			c.status(HTTPResponses.OK);
			return c.json({ secrets: [], templates: [] });
		}

		const requiredFiles: RequiredFiles = JSON.parse(rawRequiredFiles);

		requiredFiles.templates.forEach((t: RequiredFile) => (t.uploaded = alreadyUploadedFiles.includes(t.path)));
		requiredFiles.secrets.forEach((s: RequiredFile) => (s.uploaded = alreadyUploadedFiles.includes(s.path)));

		c.status(HTTPResponses.OK);
		return c.json(requiredFiles);
	}
}
