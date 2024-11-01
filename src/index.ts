import { fromHono } from "chanfana";
import { Hono } from "hono";
import { PostAlerts } from "./endpoints/alertPush";
import { Bindings } from "./types/internal";

// Start a Hono app
const app = new Hono<{ Bindings: Bindings }>();

// Setup OpenAPI registry
const openapi = fromHono(app, {
  docs_url: "/",
});

// Register OpenAPI endpoints
openapi.post("/api/v2/alerts", PostAlerts);

// Export the Hono app
export default app;
