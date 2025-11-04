import { OpenAPIRoute } from "chanfana";
import { Context } from "hono";
import { RequiredFile, RequiredFiles, RequiredFilesSpec } from "../../types/api";
import { Errors, HTTPResponses } from "../../types/http";
import { Bindings } from "../../types/internal";
import { checkAPIKey, toErrorString } from "../utils/auth";
import { requiredFilesKey, uploadedFilesKey } from "../utils/kv";

export class GetRequiredFiles extends OpenAPIRoute {
	schema = {
		operationId: "getRequiredFiles",
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
		const authResult = await checkAPIKey(c.env, c.req, "read-config");

		if (authResult.result !== "ok") {
			c.status(HTTPResponses.Unauthorized);
			return c.text(toErrorString(authResult));
		}

		const { accountID } = authResult;

		const rawRequiredFiles = await c.env.CONFIGS.get(requiredFilesKey(accountID));
		const prefix = uploadedFilesKey(accountID);
		const alreadyUploadedFiles = [...(await c.env.CONFIGS.list({ prefix })).keys].map((k) =>
			k.name.substring(prefix.length + 1),
		);

		if (!rawRequiredFiles) {
			c.status(HTTPResponses.OK);
			return c.json({ secrets: [], templates: [] });
		}

		const requiredFiles: RequiredFiles = JSON.parse(rawRequiredFiles);

		requiredFiles.templates.forEach((t: RequiredFile) => {
			if (alreadyUploadedFiles.includes(t.path)) {
				t.uploaded = true;
			}

			// Templates might be a glob.
			const parts = t.path.split(new RegExp(`[/\\\\]`));
			if (parts[parts.length - 1].includes("*")) {
				// We have a glob.
				t.uploaded = alreadyUploadedFiles.some((p) => p.startsWith(t.path));
			}
		});

		requiredFiles.secrets.forEach((s: RequiredFile) => (s.uploaded = alreadyUploadedFiles.includes(s.path)));

		c.status(HTTPResponses.OK);
		return c.json(requiredFiles);
	}
}
