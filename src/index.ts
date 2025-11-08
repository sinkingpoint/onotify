import { instrument } from "@microlabs/otel-cf-workers";
import { fromHono } from "chanfana";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { AcknowledgeAlert } from "./endpoints/acknowledgeAlert";
import { DeleteAPIKey } from "./endpoints/deleteAPIKey";
import { DeleteUsers } from "./endpoints/deleteUsers";
import { GetAccountUsers } from "./endpoints/getAccountUsers";
import { GetAlertGroups } from "./endpoints/getAlertGroups";
import { GetAlertHistory } from "./endpoints/getAlertHistory";
import { GetAlerts } from "./endpoints/getAlerts";
import { GetConfig } from "./endpoints/getConfig";
import { GetRequiredFiles } from "./endpoints/getRequiredFiles";
import { GetRoutingTree } from "./endpoints/getRoutingTree";
import GetSilence from "./endpoints/getSilence";
import { GetSilences } from "./endpoints/getSilences";
import { GetStats } from "./endpoints/getStats";
import { GetUser } from "./endpoints/getUser";
import { GetUserTokens } from "./endpoints/getUserTokens";
import { PostAlertComment } from "./endpoints/postAlertComment";
import { PostAlerts } from "./endpoints/postAlerts";
import { PostAPIKey } from "./endpoints/postAPIKey";
import { PostSilence } from "./endpoints/postSilences";
import { PostUsers } from "./endpoints/postUsers";
import { PostConfig } from "./endpoints/uploadConfig";
import { PostRequiredFiles } from "./endpoints/uploadRequiredFile";
import { Bindings } from "./types/internal";
import { OTelConfFn } from "./utils/observability";
export { default as ReceiverController } from "dos/receiver-controller";
export { AccountController } from "./dos/account-controller";
export { default as AlertGroupController } from "./dos/alert-group-controller";
export { default as SilenceController } from "./dos/silence-controller";
export { app };
// Start a Hono app
const app = new Hono<{ Bindings: Bindings }>();

app.use(
	"*",
	cors({
		allowMethods: ["GET", "POST", "OPTIONS", "DELETE"],
		allowHeaders: ["Content-Type", "Authorization"],
		exposeHeaders: ["X-Total-Count"],
		origin: (origin, c) => {
			return c.env.UI_ORIGIN;
		},
		credentials: true,
	}),
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
openapi.post("/api/v1/alerts/:fingerprint/acknowledge", AcknowledgeAlert);
openapi.get("/api/v1/config/required-files", GetRequiredFiles);
openapi.post("/api/v1/config/required-files", PostRequiredFiles);
openapi.get("/api/v2/silence/:id", GetSilence);
openapi.get("/api/v2/silences", GetSilences);
openapi.post("/api/v2/silences", PostSilence);
openapi.post("/api/v1/config", PostConfig);
openapi.get("/api/v1/config", GetConfig);
openapi.get("/api/v1/config/tree", GetRoutingTree);
openapi.get("/api/v1/user/:userID", GetUser);
openapi.get("/api/v1/alerts/:fingerprint/history", GetAlertHistory);
openapi.post("/api/v1/alerts/:fingerprint/comment", PostAlertComment);
openapi.get("/api/auth/tokens", GetUserTokens);
openapi.delete("/api/auth/tokens/:tokenId", DeleteAPIKey);
openapi.post("/api/auth/tokens", PostAPIKey);
openapi.get("/api/auth/users", GetAccountUsers);
openapi.post("/api/auth/users", PostUsers);
openapi.delete("/api/auth/users", DeleteUsers);

// Export the Hono app
export default instrument(app, OTelConfFn);
