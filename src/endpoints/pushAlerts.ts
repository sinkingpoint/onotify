import { OpenAPIRoute } from "chanfana";
import { PostableAlert, PostableAlertsSpec } from "../types/api";
import { Errors, HTTPResponses } from "../types/http";
import { Alert, Bindings } from "../types/internal";
import { Context } from "hono";
import { checkAPIKey, routingKVTreeKey, toErrorString } from "./utils";
import { RouteConfig, collapseRoutingTree } from "../types/alertmanager";
import { fingerprint } from "./utils/fingerprinting";

const REGEX_CACHE: Record<string, RegExp> = {};

export class PostConfig extends OpenAPIRoute {
  schema = {
    tags: ["config"],
    summary: "Upload an Alertmanager config",
    request: {
      body: {
        content: {
          "application/json": {
            schema: PostableAlertsSpec,
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Sucessfully pushed alerts",
      },
      ...Errors,
    },
  };

  async handle(c: Context<{ Bindings: Bindings }>) {
    const authResult = await checkAPIKey(c.env, c.req.header("Authorization"));
    if (authResult.result !== "ok") {
      c.status(HTTPResponses.Unauthorized);
      return c.text(toErrorString(authResult));
    }

    const data = await this.getValidatedData<typeof this.schema>();
    const { account_id } = authResult;
    const rawConfig = await c.env.CONFIGS.get(routingKVTreeKey(account_id));
    if (!rawConfig) {
      c.status(HTTPResponses.InternalServerError);
      return c.text("no config yet");
    }

    const { roots, tree }: ReturnType<typeof collapseRoutingTree> =
      JSON.parse(rawConfig);

    const groups: Record<string, Alert[]> = {};

    for (const postableAlert of data.body) {
      const alert = {
        fingerprint: fingerprint(postableAlert.labels).toString(),
        name: postableAlert.labels["name"] ?? "",
        status: postableAlert.status,
        ...postableAlert,
      };

      const toProcess = roots.filter((r) =>
        doesAlertMatchRoute(alert, tree[r])
      );

      while (toProcess.length > 0) {
        const nodeID = toProcess.pop();
        const node = tree[nodeID];
        if (!doesAlertMatchRoute(alert, node)) {
          continue;
        }

        if (node.receiver) {
          if (!groups[nodeID]) {
            groups[nodeID] = [alert];
          } else {
            groups[nodeID].push(alert);
          }
        }

        if (!node.continue) {
          break;
        }

        toProcess.push(...node.routes);
      }
    }
  }
}

// Gets a compiled version of the given regexp, from the cache if we have already run one.
const getRegex = (r: string): RegExp => {
  // Pad with start and end chars so that we have to match the whole thing
  if (!r.startsWith("^")) {
    r = `^${r}`;
  }

  if (!r.endsWith("$")) {
    r = `${r}$`;
  }

  if (!REGEX_CACHE[r]) {
    REGEX_CACHE[r] = new RegExp(r);
  }

  return REGEX_CACHE[r];
};

const doesAlertMatchRoute = (
  a: PostableAlert,
  r: Pick<RouteConfig, "match" | "match_re" | "matchers">
) => {
  for (const labelName of Object.keys(r.match)) {
    if ((a.labels[labelName] ?? "") !== r.match[labelName]) {
      return false;
    }
  }

  for (const labelName of Object.keys(r.match_re)) {
    const regexp = getRegex(r.match_re[labelName]);
    if (!regexp.test(a.labels[labelName] ?? "")) {
      return false;
    }
  }

  for (const m of r.matchers) {
    const testValue = a.labels[m.label_name] ?? "";
    switch (m.matcher) {
      case "=":
        if (testValue !== m.label_value) {
          return false;
        }
        break;
      case "!=":
        if (testValue === m.label_value) {
          return false;
        }
        break;
      case "=~":
      case "!~":
        const regex = getRegex(m.label_value);
        if (m.matcher === "=~" && !regex.test(testValue)) {
          return false;
        } else if (m.matcher === "!~" && regex.test(testValue)) {
          return false;
        }
        break;
    }
  }

  return true;
};
