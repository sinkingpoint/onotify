import { fromHono } from "chanfana";
import { Context, Hono, Next } from "hono";
import { cors } from "hono/cors";
import { GetAlertGroups } from "./endpoints/getAlertGroups";
import { GetAlerts } from "./endpoints/getAlerts";
import { GetConfig } from "./endpoints/getConfig";
import { GetRequiredFiles } from "./endpoints/getRequiredFiles";
import GetSilence from "./endpoints/getSilence";
import { GetSilences } from "./endpoints/getSilences";
import { PostAlerts } from "./endpoints/postAlerts";
import { PostSilence } from "./endpoints/postSilences";
import { PostConfig } from "./endpoints/uploadConfig";
import { PostRequiredFiles } from "./endpoints/uploadRequiredFile";
import { Bindings } from "./types/internal";
export { AlertDispatch } from "./alert-dispatch";
export { AccountController } from "./dos/account-controller";
export { AlertGroupController } from "./dos/alert-group-controller/alert-group-controller";

const LOCAL_ORIGIN = "http://localhost:5173";
const PROD_ORIGIN = "https://dash.onotify.com";

// Start a Hono app
const app = new Hono<{ Bindings: Bindings }>();

// Setup OpenAPI registry
const openapi = fromHono(app, {
	docs_url: "/",
	generateOperationIds: false,
});

const corsOptions = {
	allowedMethods: ["GET", "POST"],
	allowedHeaders: ["Content-Type", "Authorization"],
	credentials: true,
};

openapi.use("*", async (c: Context, next: Next) => {
	let origin = PROD_ORIGIN;
	if (c.env.WORKERS_ENV === "local") {
		origin = LOCAL_ORIGIN;
	}

	const corsOpts = {
		...corsOptions,
		origin: [origin],
	};

	return cors(corsOpts)(c, next);
});

// Register OpenAPI endpoints
openapi.get("/api/v2/alerts", GetAlerts);
openapi.get("/api/v2/alerts/groups", GetAlertGroups);
openapi.post("/api/v2/alerts", PostAlerts);
openapi.get("/api/v1/config/required-files", GetRequiredFiles);
openapi.post("/api/v1/config/required-files", PostRequiredFiles);
openapi.get("/api/v2/silence/:id", GetSilence);
openapi.get("/api/v2/silences", GetSilences);
openapi.post("/api/v2/silences", PostSilence);
openapi.post("/api/v1/config", PostConfig);
openapi.get("/api/v1/config", GetConfig);

// Export the Hono app
export default app;
