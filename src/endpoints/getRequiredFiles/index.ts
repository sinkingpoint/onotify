import { OpenAPIRoute } from "chanfana";
import { Errors, HTTPResponses } from "../../types/http";
import { Context } from "hono";
import { Bindings } from "../../types/internal";
import { checkAPIKey, toErrorString } from "../utils/auth";
import { requiredFilesKey, uploadedFilesKey } from "../utils/kv";
import { RequiredFiles } from "../../types/alertmanager";

export class GetRequiredFiles extends OpenAPIRoute {
	schema = {
		tags: ["config"],
		summary: "Get config files that are in the config, but haven't been uploaded yet",
		request: {},
		responses: {
			"200": {
				description: "Sucessfully retrieved files",
				content: {},
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
		const rawAlreadyUploadedFiles = await c.env.CONFIGS.get(uploadedFilesKey(accountID));
		if (!rawRequiredFiles) {
			c.status(HTTPResponses.OK);
			return c.json("[]");
		}

		if (!rawAlreadyUploadedFiles) {
			c.status(HTTPResponses.OK);
			return c.json(rawRequiredFiles);
		}

		const requiredFiles: RequiredFiles = JSON.parse(rawRequiredFiles);
		const alreadyUploadedFiles: Record<string, string> = JSON.parse(rawAlreadyUploadedFiles);

		requiredFiles.templates = requiredFiles.templates.filter((t) => !alreadyUploadedFiles[t.path]);

		requiredFiles.secrets = requiredFiles.secrets.filter((s) => !alreadyUploadedFiles[s]);

		c.status(HTTPResponses.OK);
		return c.json(requiredFiles);
	}
}
