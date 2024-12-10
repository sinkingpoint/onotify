import { fromHono } from "chanfana";
import { Hono } from "hono";
import { Bindings } from "./types/internal";
import { PostConfig } from "./endpoints/uploadConfig";
import { PostAlerts } from "./endpoints/postAlerts";
import { PostSilence } from "./endpoints/postSilences";
import { GetAlerts } from "./endpoints/getAlerts";
import { GetSilences } from "./endpoints/getSilences";
import { GetAlertGroups } from "./endpoints/getAlertGroups";
export { AlertGroupController } from "./dos/alert-group-controller/alert-group-controller";
export { AccountController } from "./dos/account-controller";
export { AlertDispatch } from "./alert-dispatch";

// Start a Hono app
const app = new Hono<{ Bindings: Bindings }>();

// Setup OpenAPI registry
const openapi = fromHono(app, {
  docs_url: "/",
});

// Register OpenAPI endpoints
openapi.get("/api/v2/alerts", GetAlerts);
openapi.get("/api/v2/alerts/groups", GetAlertGroups);
openapi.post("/api/v2/alerts", PostAlerts);
openapi.post("/api/v1/upload-config", PostConfig);
openapi.get("/api/v2/silences", GetSilences);
openapi.post("/api/v2/silences", PostSilence);

// Export the Hono app
export default app;
