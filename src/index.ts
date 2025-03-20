import { fromHono } from "chanfana";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { GetAlertGroups } from "./endpoints/getAlertGroups";
import { GetAlerts } from "./endpoints/getAlerts";
import { GetConfig } from "./endpoints/getConfig";
import { GetRequiredFiles } from "./endpoints/getRequiredFiles";
import { GetRoutingTree } from "./endpoints/getRoutingTree";
import GetSilence from "./endpoints/getSilence";
import { GetSilences } from "./endpoints/getSilences";
import { GetStats } from "./endpoints/getStats";
import { PostAlerts } from "./endpoints/postAlerts";
import { PostSilence } from "./endpoints/postSilences";
import { PostConfig } from "./endpoints/uploadConfig";
import { PostRequiredFiles } from "./endpoints/uploadRequiredFile";
import { Bindings } from "./types/internal";
export { AlertDispatch } from "./alert-dispatch";
export { AccountController } from "./dos/account-controller";
export { AlertGroupController } from "./dos/alert-group-controller/alert-group-controller";
export { default as SilenceController } from "./dos/silence-controller";
export { app };
const LOCAL_ORIGIN = "http://localhost:5173";
const PROD_ORIGIN = "https://dash.onotifi.com";

// Start a Hono app
const app = new Hono<{ Bindings: Bindings }>();

app.use(
	"*",
	cors({
		allowMethods: ["GET", "POST", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization"],
		exposeHeaders: ["X-Total-Count"],
		origin: (origin, c) => {
			return c.env.WORKERS_ENV === "local" ? LOCAL_ORIGIN : PROD_ORIGIN;
		},
		credentials: true,
	})
);

// Setup OpenAPI registry
const openapi = fromHono(app, {
	docs_url: "/",
	generateOperationIds: false,
});

// Register OpenAPI endpoints
openapi.get("/api/v2/alerts", GetAlerts);
openapi.get("/api/v2/:resourceType/stats", GetStats);
openapi.get("/api/v2/alerts/groups", GetAlertGroups);
openapi.post("/api/v2/alerts", PostAlerts);
openapi.get("/api/v1/config/required-files", GetRequiredFiles);
openapi.post("/api/v1/config/required-files", PostRequiredFiles);
openapi.get("/api/v2/silence/:id", GetSilence);
openapi.get("/api/v2/silences", GetSilences);
openapi.post("/api/v2/silences", PostSilence);
openapi.post("/api/v1/config", PostConfig);
openapi.get("/api/v1/config", GetConfig);
openapi.get("/api/v1/config/tree", GetRoutingTree);

// Export the Hono app
export default app;
