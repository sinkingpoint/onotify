import { Context } from "hono";
import {
	collapseRoutingTree,
	GlobalConfigSpec,
	InhibitRule,
	InhibitRuleSpec,
	Receiver,
	RouteConfig,
	RouteConfigSpec,
	TimeInterval,
	TimeIntervalSpec,
} from "../../types/alertmanager";
import { milliSecondsToDuration } from "../../types/duration";
import { Bindings } from "../../types/internal";
import {
	globalConfigKVKey,
	inhibitionsKVKey,
	loadJSONKVKey,
	receiversKVKey,
	routingTreeKVKey,
	timeIntervalsKVKey,
} from "../utils/kv";

// TODO (https://github.com/sinkingpoint/onotify/issues/7): Tests for this.

type externalRouteConfig = Omit<RouteConfig, "group_interval" | "group_wait" | "repeat_interval" | "routes"> & {
	group_interval: string;
	group_wait: string;
	repeat_interval: string;
	routes: externalRouteConfig[];
};

export const reconstituteConfig = async (ctx: Context<{ Bindings: Bindings }>, accountID: string) => {
	const global = await loadJSONKVKey(ctx.env.CONFIGS, globalConfigKVKey(accountID));
	if (!global) {
		// The config for this account hasn't been uploaded yet.
		return null;
	}

	const flattenedRoutingTree = await loadJSONKVKey(ctx.env.CONFIGS, routingTreeKVKey(accountID));
	const receivers = unRecord<Receiver>(await loadJSONKVKey(ctx.env.CONFIGS, receiversKVKey(accountID)), "name");
	const inhibitRules = await loadJSONKVKey(ctx.env.CONFIGS, inhibitionsKVKey(accountID));
	const timeIntervals = unRecord<TimeInterval>(
		await loadJSONKVKey(ctx.env.CONFIGS, timeIntervalsKVKey(accountID)),
		"name"
	);

	const reconstitutedRoutingTree = reconstituteRoutingTree(flattenedRoutingTree);
	return {
		global: removeDefaults(GlobalConfigSpec.parse({}), global),
		receivers,
		inhibit_rules: inhibitRules.map((i: InhibitRule) => removeDefaults(InhibitRuleSpec.parse({}), i)),
		time_intervals: timeIntervals.map((t) => removeDefaults(TimeIntervalSpec.parse({}), t)),
		route: reconstitutedRoutingTree,
	};
};

const reconstituteRoutingTree = ({ roots, tree }: ReturnType<typeof collapseRoutingTree>) => {
	const reassembledNodes: Record<string, externalRouteConfig> = {};
	const toProcess = [...roots];
	while (toProcess.length > 0) {
		const nodeID = toProcess.pop()!;
		const flatNode = tree[nodeID];
		const neededNodes = flatNode.routes.filter((id) => !reassembledNodes[id]);
		if (neededNodes.length > 0) {
			toProcess.push(nodeID, ...neededNodes);
			continue;
		}

		const node = { ...flatNode, routes: flatNode.routes.map((id) => reassembledNodes[id]) };
		reassembledNodes[nodeID] = routeToExternal(node);
	}

	if (roots.length === 0) {
		// We have an empty routing tree, which shouldn't ever happen. Bail.
		return null;
	} else if (roots.length === 1) {
		// We have a normal tree, which should be the default if the account has just uploaded their config.
		return reassembledNodes[roots[0]];
	} else {
		// We have multiple roots, which is only possible in our new fancy DAG config. To re-assemble, we insert a
		// pseudo-root that has the multiple roots as children, with `continue`s.
		const defaultNode = RouteConfigSpec.parse({});
		defaultNode.routes = roots.map((r) => {
			return RouteConfigSpec.parse({
				...reassembledNodes[r],
				continue: true,
			});
		});
	}
};

// Takes a Record, and returns an array of all the values, with the key set in `fieldName` on each.
const unRecord = <V>(vals: Record<string, V>, fieldName: keyof V) => {
	const flatVals = [];
	for (const key of Object.keys(vals)) {
		flatVals.push({ ...vals[key], [fieldName]: key });
	}

	return flatVals;
};

const arrayEqual = <T>(a: Array<T>, b: Array<T>) => {
	return a.length === b.length && a.every((av, i) => b[i] === av);
};

const objEqual = (a: Record<string, any>, b: Record<string, any>): boolean => {
	const aKeys = Object.keys(a);
	const bKeys = Object.keys(b);
	if (aKeys.length !== bKeys.length || !aKeys.every((k) => bKeys.includes(k))) {
		return false;
	}

	return aKeys.every((k) => isEqual(a[k], b[k]));
};

const isEqual = (a: any, b: any) => {
	if (Array.isArray(a) && Array.isArray(b)) {
		return arrayEqual(a, b);
	} else if (typeof a === "object" && typeof b === "object") {
		return objEqual(a, b);
	} else {
		return a === b;
	}
};

const removeDefaults = <T extends Record<string, any>>(def: Record<string, any>, val: T) => {
	for (const key of Object.keys(def)) {
		if (isEqual(def[key], val[key])) {
			delete val[key];
		}
	}

	return val;
};

// Internally formatted route configs have a few differences than
const routeToExternal = (r: Omit<RouteConfig, "routes"> & { routes: externalRouteConfig[] }) => {
	const defaultRoute = RouteConfigSpec.parse({});

	return {
		...removeDefaults(defaultRoute, { ...r }),
		group_wait: milliSecondsToDuration(r.group_wait),
		group_interval: milliSecondsToDuration(r.group_interval),
		repeat_interval: milliSecondsToDuration(r.repeat_interval),
	};
};
