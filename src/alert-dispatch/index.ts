import {
  WorkflowEntrypoint,
  WorkflowStep,
  WorkflowEvent,
} from "cloudflare:workers";
import { Bindings, CachedAlert } from "../types/internal";
import { accountControllerName, receiversKVKey } from "../endpoints/utils/kv";
import { Receiver } from "../types/alertmanager";
import WebhookIntegration from "../integrations/webhook";

type Params = {
  accountId: string;
  alertFingerprints: string[];
  receiverName: string;
};

type DispatchFunction<T> = (conf: T, alerts: CachedAlert[]) => Promise<void>;

const dispatch = async <T>(
  configs: T[] | undefined,
  alerts: CachedAlert[],
  receiver: DispatchFunction<T>
) => {
  if (!configs) {
    return;
  }

  const promises: Promise<void>[] = [];
  for (const config of configs) {
    promises.push(receiver(config, alerts));
  }

  await Promise.all(promises);
};

export class AlertDispatch extends WorkflowEntrypoint<Bindings, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    const { accountId, alertFingerprints, receiverName } = event.payload;
    const controllerName = accountControllerName(accountId);
    const accountControllerID =
      this.env.ACCOUNT_CONTROLLER.idFromName(controllerName);
    const accountController =
      this.env.ACCOUNT_CONTROLLER.get(accountControllerID);

    const kvKey = receiversKVKey(accountId);
    const rawReceivers = await this.env.CONFIGS.get(kvKey);
    if (!rawReceivers) {
      throw `failed to load receivers from account!`;
    }
    const receivers = JSON.parse(rawReceivers);
    const receiver = receivers[receiverName] as Receiver;

    // First, resolve the alerts to a final list of alerts to send.
    const alerts = await step.do("resolve alerts", () => {
      return accountController.getAlerts({
        fingerprints: alertFingerprints,
        silenced: false,
        inhibited: false,
      });
    });

    if (alerts.length === 0) {
      // There are no alerts that aren't silenced or inhibited, bail.
      return;
    }

    await step.do("webhooks", () =>
      dispatch(receiver.webhook_configs, alerts, WebhookIntegration)
    );
  }
}
