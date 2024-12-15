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
import { cors } from "hono/cors";

const LOCAL_ORIGIN = "http://localhost:5173";
const PROD_ORIGIN = "https://dash.onotify.com";

// Start a Hono app
const app = new Hono<{ Bindings: Bindings }>();

// Setup OpenAPI registry
const openapi = fromHono(app, {
  docs_url: "/",
});

const corsOptions = {
  allowedMethods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

openapi.use("*", async (c, next) => {
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
openapi.post("/api/v1/upload-config", PostConfig);
openapi.get("/api/v2/silences", GetSilences);
openapi.post("/api/v2/silences", PostSilence);

// Export the Hono app
export default app;
