import { WebhookConfig } from "../../types/alertmanager";
import { CachedAlert } from "../../types/internal";

const WebhookIntegration = async (
  config: WebhookConfig,
  alerts: CachedAlert[]
) => {
  console.log("webhook!!!!!", alerts);
};

export default WebhookIntegration;
