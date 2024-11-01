import { fromHono } from "chanfana";
import { Hono } from "hono";
import { PostAlerts } from "./endpoints/alertPush";

// Start a Hono app
const app = new Hono();

// Setup OpenAPI registry
const openapi = fromHono(app, {
  docs_url: "/",
});

// Register OpenAPI endpoints
openapi.post("/api/v2/alerts", PostAlerts);

// Export the Hono app
export default app;
