import { OpenAPIRoute } from "chanfana";
import { Context } from "hono";
import { z } from "zod";
import { collapseRoutingTree, FlatRouteConfigSpec } from "../../types/alertmanager";
import { milliSecondsToDuration } from "../../types/duration";
import { Errors, HTTPResponses } from "../../types/http";
import { Bindings } from "../../types/internal";
import { checkAPIKey, toErrorString } from "../utils/auth";
import { loadJSONKVKey, routingTreeKVKey } from "../utils/kv";

export class GetRoutingTree extends OpenAPIRoute {
	schema = {
		operationId: "getRoutingTree",
		tags: ["config"],
		summary: "Get a flattened version of the routing tree",
		request: {},
		responses: {
			"200": {
				description: "Sucessfully got config",
				content: {
					"application/json": {
						schema: z.record(
							FlatRouteConfigSpec.omit({ group_wait: true, group_interval: true, repeat_interval: true }).extend({
								group_wait: z.string(),
								group_interval: z.string(),
								repeat_interval: z.string(),
							})
						),
					},
				},
			},
			...Errors,
		},
	};

	async handle(ctx: Context<{ Bindings: Bindings }>) {
		const authResult = await checkAPIKey(ctx.env, ctx.req.header("Authorization"), "get-config");

		if (authResult.result !== "ok") {
			ctx.status(HTTPResponses.Unauthorized);
			return ctx.text(toErrorString(authResult));
		}

		const flattenedRoutingTree: ReturnType<typeof collapseRoutingTree> = await loadJSONKVKey(
			ctx.env.CONFIGS,
			routingTreeKVKey(authResult.accountID)
		);

		for (const nodeID of Object.keys(flattenedRoutingTree["tree"])) {
			const node = flattenedRoutingTree["tree"][nodeID];

			// Fudge the types here to make them correct for the API. Anything after
			// this _should not_ interact with the intervals as the typechecker will be wrong.
			node.group_interval = milliSecondsToDuration(node.group_interval) as any;
			node.group_wait = milliSecondsToDuration(node.group_wait) as any;
			node.repeat_interval = milliSecondsToDuration(node.repeat_interval) as any;
		}

		ctx.status(HTTPResponses.OK);
		return ctx.json(flattenedRoutingTree["tree"]);
	}
}
