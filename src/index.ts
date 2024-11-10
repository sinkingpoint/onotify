import { fromHono } from "chanfana";
import { Hono } from "hono";
import { Bindings } from "./types/internal";
import { PostConfig } from "./endpoints/uploadConfig";
import { PostAlerts } from "./endpoints/pushAlerts";
import { PostSilence } from "./endpoints/postSilences";
export { AlertGroupController } from "./dos/alert-group-controller/alert-group-controller";

// Start a Hono app
const app = new Hono<{ Bindings: Bindings }>();

// Setup OpenAPI registry
const openapi = fromHono(app, {
  docs_url: "/",
});

// Register OpenAPI endpoints
openapi.post("/api/v2/alerts", PostAlerts);
openapi.post("/api/v1/upload-config", PostConfig);
openapi.post("/api/v2/silences", PostSilence);

// Export the Hono app
export default app;
