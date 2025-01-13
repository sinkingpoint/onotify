import { OpenAPIRoute } from "chanfana";
import { Context } from "hono";
import {
	AlertmanagerConfig,
	AlertmanagerConfigSpec,
	collapseRoutingTree,
	Receiver,
	TimeInterval,
} from "../types/alertmanager";
import { RequiredFiles } from "../types/api";
import { Errors, HTTPResponses } from "../types/http";
import { Bindings } from "../types/internal";
import { checkAPIKey, toErrorString } from "./utils/auth";
import {
	globalConfigKVKey,
	inhibitionsKVKey,
	receiversKVKey,
	requiredFilesKey,
	routingTreeKVKey,
	timeIntervalsKVKey,
} from "./utils/kv";

export class PostConfig extends OpenAPIRoute {
	schema = {
		operationId: "postConfig",
		tags: ["config"],
		summary: "Upload an Alertmanager config",
		request: {
			body: {
				content: {
					"application/json": {
						schema: AlertmanagerConfigSpec,
					},
				},
			},
		},
		responses: {
			"200": {
				description: "Successfully uploaded config",
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

		const { accountID: account_id } = authResult;

		// Get validated data
		const data = await this.getValidatedData<typeof this.schema>();
		const config = data.body;

		const routingTree = collapseRoutingTree(config);
		const receivers: Record<string, Receiver> = {};
		for (const receiver of config.receivers) {
			receivers[receiver.name] = receiver;
		}

		const timeIntervals: Record<string, TimeInterval> = {};
		for (const interval of config.time_intervals) {
			timeIntervals[interval.name] = interval;
		}

		const promises = [];

		promises.push(c.env.CONFIGS.put(globalConfigKVKey(account_id), JSON.stringify(config.global)));
		promises.push(c.env.CONFIGS.put(routingTreeKVKey(account_id), JSON.stringify(routingTree)));
		promises.push(c.env.CONFIGS.put(receiversKVKey(account_id), JSON.stringify(receivers)));
		promises.push(c.env.CONFIGS.put(inhibitionsKVKey(account_id), JSON.stringify(config.inhibit_rules)));
		promises.push(c.env.CONFIGS.put(timeIntervalsKVKey(account_id), JSON.stringify(timeIntervals)));

		const requiredFiles = getRequiredFiles(config);
		promises.push(c.env.CONFIGS.put(requiredFilesKey(account_id), JSON.stringify(requiredFiles)));

		await Promise.all(promises);
		// TODO(https://github.com/sinkingpoint/onotify/issues/4, https://github.com/sinkingpoint/onotify/issues/5): Handle custom templates + `mute_time_intervals`

		return c.text("ok");
	}
}

// getRequiredFiles takes a config and returns a list of auxillary files that
// are needed to assemble the config. This includes secret files, certs, and templates
// that are referenced in various bits of the config.
export const getRequiredFiles = (conf: AlertmanagerConfig): RequiredFiles => {
	let toScan = [conf.global, ...conf.receivers];
	const requiredFilesSet = new Set<string>();
	for (const scan of toScan) {
		for (const key of Object.keys(scan)) {
			const val = scan[key as keyof typeof scan];
			// Rather than being super strict here, we simply pull out anything that has a _file suffix.
			// That should capture everything except templates.
			if (key.endsWith("_file")) {
				requiredFilesSet.add(val);
			} else if (Array.isArray(val)) {
				toScan.push(...(val as Array<any>));
			} else if (typeof val === "object") {
				toScan.push(val);
			}
		}
	}

	return {
		secrets: [...requiredFilesSet.values()].sort().map((s) => {
			return {
				path: s,
				isDir: false, // Secrets are never directories.
				uploaded: false, // We don't actually know this, but it'll get filled in by the API before we export it.
			};
		}),
		templates: conf.templates.sort().map((s) => {
			return {
				path: s,
				isDir: s.includes("*"),
				uploaded: false,
			};
		}),
	};
};
