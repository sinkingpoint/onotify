import { fromHono } from "chanfana";
import { Hono } from "hono";
import { Bindings } from "./types/internal";
import { PostConfig } from "./endpoints/uploadConfig";

// Start a Hono app
const app = new Hono<{ Bindings: Bindings }>();

// Setup OpenAPI registry
const openapi = fromHono(app, {
  docs_url: "/",
});

// Register OpenAPI endpoints
openapi.post("/api/v1/upload-config", PostConfig);

// Export the Hono app
export default app;
