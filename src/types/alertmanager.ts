import { z, ZodTypeDef } from "zod";
import hash from "object-hash";

// Returns a Zod refinement that rejects the value if the two fields
// are not mutually exclusive.
export const enforceMutuallyExclusive = (
  k1: string,
  k2: string,
  require_one: boolean = false
): [(val: any) => boolean, string] => {
  return [
    (val: any) => {
      if (!val) {
        return !require_one;
      }

      const hasK1 = !!val[k1];
      const hasK2 = !!val[k2];
      const mutuallyExclusive = hasK1 != hasK2;
      if (require_one) {
        return mutuallyExclusive && (hasK1 || hasK2);
      } else {
        return mutuallyExclusive || (!hasK1 && !hasK2);
      }
    },
    `${k1} and ${k2} are mutually exclusive`,
  ];
};

export const TLSConfigSpec = z
  .object({
    // CA certificate to validate the server certificate with.
    ca_file: z.string().optional(),

    // Certificate and key files for client cert authentication to the server.
    cert_file: z.string().optional(),
    key_file: z.string().optional(),

    // ServerName extension to indicate the name of the server.
    server_name: z.string().optional(),

    // Disable validation of the server certificate.
    insecure_skip_verify: z.boolean().default(false),
    min_version: z.string().optional(),
    max_version: z.string().optional(),
  })
  .strict();

export const OAuth2ConfigSpec = z
  .object({
    client_id: z.string(),
    client_secret: z.string().optional(),
    // Read the client secret from a file.
    // It is mutually exclusive with `client_secret`.
    client_secret_file: z.string().optional(),

    // Scopes for the token request.
    scopes: z.array(z.string()).default([]),

    // The URL to fetch the token from.
    token_url: z.string(),

    // Optional parameters to append to the token URL.
    endpoint_params: z.array(z.string()).default([]),

    // Configures the token request's TLS settings.
    tls_config: TLSConfigSpec.default({ insecure_skip_verify: false }),

    // Optional proxy URL.
    proxy_url: z.string().optional(),

    // Comma-separated string that can contain IPs, CIDR notation, domain names
    // that should be excluded from proxying. IP and domain names can contain port numbers.
    no_proxy: z.string().optional(),

    // Use proxy URL indicated by environment variables (HTTP_PROXY, https_proxy, HTTPs_PROXY, https_proxy, and no_proxy)
    proxy_from_environment: z.boolean().default(false),

    // Specifies headers to send to proxies during CONNECT requests.
    proxy_connect_header: z.record(z.string(), z.array(z.string())),
  })
  .strict()
  .refine(
    ...enforceMutuallyExclusive("client_secret", "client_secret_file", true)
  );

export const HTTPConfigSpec = z
  .object({
    // Sets the `Authorization` header with the configured username and password.
    // password and password_file are mutually exclusive.
    basic_auth: z
      .object({
        username: z.string(),
        password: z.string().optional(),
        password_file: z.string().optional(),
      })
      .optional()
      .refine(...enforceMutuallyExclusive("password", "password_file")),
    // Optional the `Authorization` header configuration.
    authorization: z
      .object({
        // Sets the authentication type.
        type: z.string().default("Bearer"),
        // Sets the credentials. It is mutually exclusive with `credentials_file`.
        credentials: z.string().optional(),

        // Sets the credentials with the credentials read from the configured file.
        // It is mutually exclusive with `credentials`.
        credentials_file: z.string().optional(),
      })
      .optional()
      .refine(...enforceMutuallyExclusive("credentials", "credentials_file")),
    // Optional OAuth 2.0 configuration.
    // Cannot be used at the same time as basic_auth or authorization.
    oauth2: OAuth2ConfigSpec.optional(),
    // Whether to enable HTTP2.
    enable_http2: z.boolean().default(true),
    // Optional proxy URL.
    proxy_url: z.string().optional(),

    // Comma-separated string that can contain IPs, CIDR notation, domain names
    // that should be excluded from proxying. IP and domain names can
    // contain port numbers.
    no_proxy: z.string().optional(),

    // Use proxy URL indicated by environment variables (HTTP_PROXY, http_proxy, HTTPS_PROXY, https_proxy, NO_PROXY, and no_proxy)
    proxy_from_environment: z.boolean().default(false),

    // Specifies headers to send to proxies during CONNECT requests.
    proxy_connect_header: z.record(z.string(), z.array(z.string())).default({}),

    // Configure whether HTTP requests follow HTTP 3xx redirects.
    follow_redirects: z.boolean().default(true),

    // Configures the TLS settings.
    tls_config: TLSConfigSpec.default(TLSConfigSpec.parse({})),
  })
  .strict()
  .refine(...enforceMutuallyExclusive("basic_auth", "authorization"));

export const LabelNameSpec = z.string().refine((val) => {
  return val.match(/^[^{}!=~,\\"'`\s]+$/);
}, "label_name must match `/^[^{}!=~,\\\"'`\\s]+$/`");

const unquote = (s: string): string => {
  if (s.length < 2) {
    throw "expected length >= 2";
  }

  const openQuote = s[0];
  if (!['"', "'", "`"].includes(openQuote)) {
    throw `invalid open quote: '${openQuote}''`;
  }

  if (s[s.length - 1] !== openQuote) {
    throw `expected "${openQuote} to end quote, got ${s[s.length - 1]}`;
  }

  let unquoted = s.substring(1, s.length - 1);
  unquoted = unquoted.replace("\\n", "\n");
  unquoted = unquoted.replace("\\t", "\t");
  unquoted = unquoted.replace('\\"', '"');
  unquoted = unquoted.replace(`\\'`, `'`);

  return unquoted;
};

export const MatcherSpec = z.string().transform((val) => {
  const parts = val.match(/^([^{}!=~,\\"'`\s]+)(=|!=|=~|!~)(".+")$/);

  if (!parts || parts.length != 4) {
    throw `expected a valid matcher, not ${val}`;
  }

  const matcher = unquote(parts[3]);

  return {
    label_name: parts[1],
    matcher: parts[2],
    label_value: matcher,
  };
});

const leadingInt = (s: string): [number, string] => {
  let i = 0;
  let x = 0;
  for (; i < s.length; i++) {
    const c = s[i];
    if (
      c.charCodeAt(0) < "0".charCodeAt(0) ||
      c.charCodeAt(0) > "9".charCodeAt(0)
    ) {
      break;
    }

    x = x * 10 + (c.charCodeAt(0) - "0".charCodeAt(0));
  }

  return [x, s.substring(i)];
};

const leadingFraction = (s: string): [number, number, string] => {
  let i = 0;
  let scale = 1;
  let x = 0;
  for (; i < s.length; i++) {
    const c = s[i];
    if (
      c.charCodeAt(0) < "0".charCodeAt(0) ||
      c.charCodeAt(0) > "9".charCodeAt(0)
    ) {
      break;
    }

    x = x * 10 + (c.charCodeAt(0) - "0".charCodeAt(0));
    scale *= 10;
  }

  return [x, scale, s.substring(i)];
};

// Returns false if the given string is technically a valid duration unit in Go,
// but we choose not to support it here.
const isUnitAllowed = (s: string): boolean => {
  switch (s) {
    case "ns":
    case "us":
    case "µs":
    case "μs":
    case "ms":
      return false;
  }

  return true;
};

// Returns the number of microseconds in one of the given unit.
const unitMap = (s: string): number | null => {
  const millisecond = 1;
  const second = 1000 * millisecond;
  const minute = 60 * second;
  const hour = 60 * minute;
  switch (s) {
    case "ms":
      return millisecond;
    case "s":
      return second;
    case "m":
      return minute;
    case "h":
      return hour;
  }

  return null;
};

// Handles Go duration types, like 30s, 3h1m, or 0.5m.
export const DurationSpec = z.string().transform((s) => {
  let d = 0;
  let neg = false;
  let orig = s;

  if (s !== "") {
    const c = s[0];
    if (c === "-" || c === "+") {
      neg = c === "-";
      s = s.substring(1);
    }
  }

  if (s === "0") {
    return 0;
  }

  if (s === "") {
    throw `invalid duration: "${orig}`;
  }

  while (s !== "") {
    let scale = 1;
    let f = 0;
    if (!(s[0] === "." || ("0" <= s[0] && s[0] <= "9"))) {
      throw `invalid duration: "${orig}"`;
    }

    let pl = s.length;
    const leading = leadingInt(s);
    let v = leading[0];
    s = leading[1];

    const pre = pl != s.length;
    let post = false;
    if (s !== "" && s[0] === ".") {
      s = s.substring(1);
      pl = s.length;
      const [newF, newScale, newS] = leadingFraction(s);
      s = newS;
      post = pl != s.length;
      f = newF;
      scale = newScale;
    }

    if (!pre && !post) {
      // no digits (e.g. ".s" or "-.s")
      throw `invalid duration: "${orig}"`;
    }

    let i = 0;
    for (; i < s.length; i++) {
      const c = s[i];
      if (
        c === "." ||
        ("0".charCodeAt(0) <= c.charCodeAt(0) &&
          c.charCodeAt(0) <= "9".charCodeAt(0))
      ) {
        break;
      }
    }

    if (i === 0) {
      throw `missing unit in duration: "${orig}"`;
    }

    const u = s.substring(0, i);
    s = s.substring(i);
    const unit = unitMap(u);
    if (!isUnitAllowed(u)) {
      throw `unsupported unit ${u}`;
    }

    if (unit === null) {
      throw `unknown unit '${u}' in duration: ${orig}`;
    }

    v *= unit;
    if (f > 0) {
      v += f * (unit / scale);
    }

    d += v;
  }
  if (neg) {
    return -d;
  }

  return d;
});

const baseRouteSpec = z
  .object({
    receiver: z.string().optional(),
    // The labels by which incoming alerts are grouped together. For example,
    // multiple alerts coming in for cluster=A and alertname=LatencyHigh would
    // be batched into a single group.
    //
    // To aggregate by all possible labels use the special value '...' as the sole label name, for example:
    // group_by: ['...']
    // This effectively disables aggregation entirely, passing through all
    // alerts as-is. This is unlikely to be what you want, unless you have
    // a very low alert volume or your upstream notification system performs
    // its own grouping.
    group_by: z.array(z.string()).optional(),

    // Whether an alert should continue matching subsequent sibling nodes.
    continue: z.boolean().default(false),

    // DEPRECATED: Use matchers below.
    // A set of equality matchers an alert has to fulfill to match the node.
    match: z.record(z.string(), z.string()).default({}),

    // DEPRECATED: Use matchers below.
    // A set of regex-matchers an alert has to fulfill to match the node.
    match_re: z.record(z.string(), z.string()).default({}),

    // A list of matchers that an alert has to fulfill to match the node.
    matchers: z.array(MatcherSpec).default([]),

    // How long to initially wait to send a notification for a group
    // of alerts. Allows to wait for an inhibiting alert to arrive or collect
    // more initial alerts for the same group. (Usually ~0s to few minutes.)
    // If omitted, child routes inherit the group_wait of the parent route.
    group_wait: DurationSpec.default("30s"),

    // How long to wait before sending a notification about new alerts that
    // are added to a group of alerts for which an initial notification has
    // already been sent. (Usually ~5m or more.) If omitted, child routes
    // inherit the group_interval of the parent route.
    group_interval: DurationSpec.default("5m"),

    // How long to wait before sending a notification again if it has already
    // been sent successfully for an alert. (Usually ~3h or more). If omitted,
    // child routes inherit the repeat_interval of the parent route.
    // Note that this parameter is implicitly bound by Alertmanager's
    // `--data.retention` configuration flag. Notifications will be resent after either
    // repeat_interval or the data retention period have passed, whichever
    // occurs first. `repeat_interval` should be a multiple of `group_interval`.
    repeat_interval: DurationSpec.default("4h"),

    // Times when the route should be muted. These must match the name of a
    // mute time interval defined in the mute_time_intervals section.
    // Additionally, the root node cannot have any mute times.
    // When a route is muted it will not send any notifications, but
    // otherwise acts normally (including ending the route-matching process
    // if the `continue` option is not set.)
    mute_time_intervals: z.array(z.string()).default([]),

    // Times when the route should be active. These must match the name of a
    // time interval defined in the time_intervals section. An empty value
    // means that the route is always active.
    // Additionally, the root node cannot have any active times.
    // The route will send notifications only when active, but otherwise
    // acts normally (including ending the route-matching process
    // if the `continue` option is not set).
    active_time_intervals: z.array(z.string()).default([]),
  })
  .strict();

type inRouteSpec = z.input<typeof baseRouteSpec> & {
  routes?: inRouteSpec[];
};

type outRouteSpec = z.output<typeof baseRouteSpec> & {
  routes?: outRouteSpec[];
};

type RouteSpec = outRouteSpec;

export const RouteConfigSpec: z.ZodType<outRouteSpec, ZodTypeDef, inRouteSpec> =
  baseRouteSpec
    .extend({
      routes: z.lazy(() => RouteConfigSpec.array()).optional(),
    })
    .strict();

export const DiscordConfigSpec = z
  .object({
    // Whether to notify about resolved alerts.
    send_resolved: z.boolean().default(true),

    // The Discord webhook URL.
    // webhook_url and webhook_url_file are mutually exclusive.
    webhook_url: z.string().optional(),
    webhook_url_file: z.string().optional(),

    // Message title template.
    title: z.string().default('{{ template "discord.default.title" . }}'),
    message: z.string().default('{{ template "discord.default.message" . }}'),
    http_config: HTTPConfigSpec.optional(),
  })
  .strict()
  .refine(...enforceMutuallyExclusive("webhook_url", "webhook_url_file", true));

export const EmailConfigSpec = z
  .object({
    // Whether to notify about resolved alerts.
    send_resolved: z.boolean().default(false),

    // The email address to send notifications to.
    to: z.string(),

    // The sender's address.
    from: z.string().optional(),

    // The SMTP host through which emails are sent.
    smarthost: z.string().optional(),

    // The hostname to identify to the SMTP server.
    hello: z.string().optional(),

    // SMTP authentication information.
    // auth_password and auth_password_file are mutually exclusive.
    auth_username: z.string().optional(),
    auth_password: z.string().optional(),
    auth_password_file: z.string().optional(),
    auth_secret: z.string().optional(),
    auth_identity: z.string().optional(),

    // The SMTP TLS requirement.
    // Note that Go does not support unencrypted connections to remote SMTP endpoints.
    require_tls: z.boolean().optional(),

    tls_config: TLSConfigSpec.optional(),

    html: z.string().optional(),
    text: z.string().optional(),
    headers: z.record(z.string(), z.string()).default({}),
  })
  .strict()
  .refine(...enforceMutuallyExclusive("auth_password", "auth_password_file"))
  .refine(...enforceMutuallyExclusive("html", "text", false));

export const MSTeamsConfigSpec = z
  .object({
    // Whether to notify about resolved alerts.
    send_resolved: z.boolean().default(true),

    // The incoming webhook URL.
    // webhook_url and webhook_url_file are mutually exclusive.
    webhook_url: z.string().optional(),
    webhook_url_file: z.string().optional(),

    // Message title template.
    title: z.string().default('{{ template "msteams.default.title" . }}'),
    // Message summary template.
    summary: z.string().default('{{ template "msteams.default.summary" . }}'),
    // Message body template.
    text: z.string().default('{{ template "msteams.default.text" . }}'),
    // The HTTP client's configuration.
    http_config: HTTPConfigSpec.optional(),
  })
  .strict()
  .refine(...enforceMutuallyExclusive("webhook_url", "webhook_url_file", true));

export const OpsGenieRespondersSpec = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    username: z.string().optional(),
    type: z.string(),
  })
  .strict();

export const OpsGenieConfigSpec = z
  .object({
    // Whether to notify about resolved alerts.
    send_resolved: z.boolean().default(true),

    // The API key to use when talking to the OpsGenie API.
    api_key: z.string().optional(),

    // The filepath to API key to use when talking to the OpsGenie API. Conflicts with api_key.
    api_key_file: z.string().optional(),

    // The host to send OpsGenie API requests to.
    api_url: z.string().optional(),

    // Alert text limited to 130 characters.
    message: z.string().default('{{ template "opsgenie.default.message" . }}'),

    // A description of the alert.
    description: z
      .string()
      .default('{{ template "opsgenie.default.description" . }}'),

    // A backlink to the sender of the notification.
    source: z.string().default('{{ template "opsgenie.default.source" . }}'),

    // A set of arbitrary key/value pairs that provide further detail about the alert.
    // All common labels are included as details by default.
    details: z.record(z.string(), z.string()).optional(),

    // List of responders responsible for notifications.
    responders: OpsGenieRespondersSpec.array().default([]),

    // Comma separated list of tags attached to the notifications.
    tags: z.string().optional(),

    // Additional alert note.
    note: z.string().optional(),

    // Priority level of alert. Possible values are P1, P2, P3, P4, and P5.
    priority: z.string().optional(),

    // Whether to update message and description of the alert in OpsGenie if it already exists
    // By default, the alert is never updated in OpsGenie, the new message only appears in activity log.
    update_alerts: z.boolean().default(false),

    // Optional field that can be used to specify which domain alert is related to.
    entity: z.string().optional(),

    // Comma separated list of actions that will be available for the alert.
    actions: z.string().optional(),

    http_config: HTTPConfigSpec.optional(),
  })
  .strict()
  .refine(...enforceMutuallyExclusive("api_key", "api_key_file", true));

export const PagerdutyImageConfigSpec = z
  .object({
    href: z.string().optional(),
    src: z.string().optional(),
    alt: z.string().optional(),
  })
  .strict();

export const PagerdutyLinkConfigSpec = z
  .object({
    href: z.string().optional(),
    text: z.string().optional(),
  })
  .strict();

export const PagerdutyConfigSpec = z
  .object({
    // Whether to notify about resolved alerts.
    send_resolved: z.boolean().default(true),

    // The routing and service keys are mutually exclusive.
    // The PagerDuty integration key (when using PagerDuty integration type `Events API v2`).
    // It is mutually exclusive with `routing_key_file`.
    routing_key: z.string().optional(),

    // Read the Pager Duty routing key from a file.
    // It is mutually exclusive with `routing_key`.
    routing_key_file: z.string().optional(),

    // The PagerDuty integration key (when using PagerDuty integration type `Prometheus`).
    //It is mutually exclusive with `service_key_file`.
    service_key: z.string().optional(),

    // Read the Pager Duty service key from a file.
    // It is mutually exclusive with `service_key`.
    service_key_file: z.string().optional(),

    // The URL to send API requests to
    url: z.string().optional(),

    // The client identification of the Alertmanager.
    client: z.string().default('{{ template "pagerduty.default.client" . }}'),

    //  A backlink to the sender of the notification.
    client_url: z
      .string()
      .default('{{ template "pagerduty.default.clientURL" . }}'),

    // A description of the incident.
    description: z
      .string()
      .default('{{ template "pagerduty.default.description" .}}'),

    // Severity of the incident.
    severity: z.string().default("error"),

    // Unique location of the affected system.
    source: z.string().default("client"),

    // A set of arbitrary key/value pairs that provide further detail about the incident.
    details: z.record(z.string(), z.string()).default({
      firing: '{{ template "pagerduty.default.instances" .Alerts.Firing }}',
      resolved: '{{ template "pagerduty.default.instances" .Alerts.Resolved }}',
      num_firing: "{{ .Alerts.Firing | len }}",
      num_resolved: "{{ .Alerts.Resolved | len }}",
    }),

    // Images to attach to the incident.
    images: z.array(PagerdutyImageConfigSpec).default([]),

    // Links to attach to the incident.
    links: z.array(PagerdutyLinkConfigSpec).default([]),

    // The part or component of the affected system that is broken.
    component: z.string().optional(),

    // A cluster or grouping of sources.
    group: z.string().optional(),

    // The class/type of the event.
    class: z.string().optional(),

    http_config: HTTPConfigSpec.optional(),
  })
  .strict()
  .refine(...enforceMutuallyExclusive("routing_key", "routing_key_file"))
  .refine(...enforceMutuallyExclusive("service_key", "service_key_file"));

export const PushoverConfigSpec = z
  .object({
    // Whether to notify about resolved alerts.
    send_resolved: z.boolean().default(true),

    // The recipient user's key.
    // user_key and user_key_file are mutually exclusive.
    user_key: z.string().optional(),
    user_key_file: z.string().optional(),

    // Your registered application's API token, see https://pushover.net/apps
    // You can also register a token by cloning this Prometheus app:
    // https://pushover.net/apps/clone/prometheus
    // token and token_file are mutually exclusive.
    token: z.string().optional(),
    token_file: z.string().optional(),

    // Notification title.
    title: z.string().default('{{ template "pushover.default.title" . }}'),

    // Notification message
    message: z.string().default('{{ template "pushover.default.message" . }}'),

    // A supplementary URL shown alongside the message.
    url: z.string().default('{{ template "pushover.default.url" . }}'),

    // Optional device to send notification to, see https://pushover.net/api#device
    device: z.string().optional(),

    // Optional sound to use for notification, see https://pushover.net/api#sound
    sound: z.string().optional(),

    // Priority, see https://pushover.net/api#priority
    priority: z
      .string()
      .default('{{ if eq .Status "firing" }}2{{ else }}0{{ end }}'),

    // How often the Pushover servers will send the same notification to the user.
    // Must be at least 30 seconds.
    retry: DurationSpec.default("1m"),

    // How long your notification will continue to be retried for, unless the user acknowledges the notification.
    expire: DurationSpec.default("1h"),

    // Optional time to live (TTL) to use for notification, see https://pushover.net/api#ttl
    ttl: DurationSpec.optional(),

    http_config: HTTPConfigSpec.optional(),
  })
  .strict()
  .refine(...enforceMutuallyExclusive("user_key", "user_key_file", true))
  .refine(...enforceMutuallyExclusive("token", "token_file", true));

export const SlackActionConfirmFieldConfigSpec = z
  .object({
    text: z.string(),
    dismiss_text: z.string().default(""),
    ok_text: z.string().default(""),
    title: z.string().default(""),
  })
  .strict();

export const SlackActionConfigSpec = z
  .object({
    text: z.string(),
    type: z.string(),
    // Either url or name and value are mandatory.
    url: z.string().optional(),
    name: z.string().optional(),
    value: z.string().optional(),

    confirm: SlackActionConfirmFieldConfigSpec.optional(),
    style: z.string().default(""),
  })
  .strict();

export const SlackFieldConfigSpec = z
  .object({
    title: z.string(),
    value: z.string(),
    short: z.boolean().optional(),
  })
  .strict();

export const SlackConfigSpec = z
  .object({
    // Whether to notify about resolved alerts.
    send_resolved: z.boolean().default(false),

    // The Slack webhook URL. Either api_url or api_url_file should be set.
    // Defaults to global settings if none are set here.
    api_url: z.string().optional(),
    api_url_file: z.string().optional(),

    // The channel or user to send notifications to.
    channel: z.string(),

    // API request data as defined by the Slack webhook API.
    icon_emoji: z.string().optional(),
    icon_url: z.string().optional(),
    link_names: z.boolean().default(false),
    username: z.string().default('{{ template "slack.default.username" . }}'),

    // The following parameters define the attachment.
    actions: z.array(SlackActionConfigSpec).default([]),
    callback_id: z
      .string()
      .default('{{ template "slack.default.callbackid" . }}'),
    color: z
      .string()
      .default('{{ if eq .Status "firing" }}danger{{ else }}good{{ end }}'),
    fallback: z.string().default('{{ template "slack.default.fallback" . }}'),
    fields: z.array(SlackFieldConfigSpec).default([]),
    footer: z.string().default('{{ template "slack.default.footer" . }}'),
    mrkdwn_in: z.array(z.string()).default(["fallback", "pretext", "text"]),
    pretext: z.string().default('{{ template "slack.default.pretext" . }}'),
    short_fields: z.boolean().default(false),
    text: z.string().default('{{ template "slack.default.text" . }}'),
    title: z.string().default('{{ template "slack.default.title" . }}'),
    title_link: z
      .string()
      .default('{{ template "slack.default.titlelink" . }}'),
    image_url: z.string().optional(),
    thumb_url: z.string().optional(),

    http_config: HTTPConfigSpec.optional(),
  })
  .strict()
  .refine(...enforceMutuallyExclusive("api_url", "api_url_file", true));

export const AWSSigv4ConfigSpec = z
  .object({
    // The AWS region. If blank, the region from the default credentials chain is used.
    region: z.string().optional(),

    // The AWS API keys. Both access_key and secret_key must be supplied or both must be blank.
    // If blank the environment variables `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are used.
    access_key: z.string().optional(),
    secret_key: z.string().optional(),

    // Named AWS profile used to authenticate.
    profile: z.string().optional(),

    // AWS Role ARN, an alternative to using AWS API keys.
    role_arn: z.string().optional(),
  })
  .strict();

export const SNSConfigSpec = z
  .object({
    // Whether to notify about resolved alerts.
    send_resolved: z.boolean().default(true),

    // The SNS API URL i.e. https://sns.us-east-2.amazonaws.com.
    // If not specified, the SNS API URL from the SNS SDK will be used.
    api_url: z.string().optional(),

    // Configures AWS's Signature Verification 4 signing process to sign requests.
    sigv4: AWSSigv4ConfigSpec.optional(),

    // SNS topic ARN, i.e. arn:aws:sns:us-east-2:698519295917:My-Topic
    // If you don't specify this value, you must specify a value for the phone_number or target_arn.
    // If you are using a FIFO SNS topic you should set a message group interval longer than 5 minutes
    // to prevent messages with the same group key being deduplicated by the SNS default deduplication window
    topic_arn: z.string().optional(),

    // Subject line when the message is delivered to email endpoints.
    subject: z.string().default('{{ template "sns.default.subject" .}}'),

    // Phone number if message is delivered via SMS in E.164 format.
    // If you don't specify this value, you must specify a value for the topic_arn or target_arn.
    phone_number: z.string().optional(),

    // The  mobile platform endpoint ARN if message is delivered via mobile notifications.
    // If you don't specify this value, you must specify a value for the topic_arn or phone_number.
    target_arn: z.string().optional(),

    // The message content of the SNS notification.
    message: z.string().default('{{ template "sns.default.message" .}}'),

    // SNS message attributes.
    attributes: z.record(z.string(), z.string()).default({}),

    // The HTTP client's configuration.
    http_config: HTTPConfigSpec.optional(),
  })
  .strict();

export const TelegramConfigSpec = z
  .object({
    // Whether to notify about resolved alerts.
    send_resolved: z.boolean().default(true),

    // The Telegram API URL i.e. https://api.telegram.org.
    // If not specified, default API URL will be used.
    api_url: z.string().optional(),

    // Telegram bot token. It is mutually exclusive with `bot_token_file`.
    bot_token: z.string().optional(),
    // Read the Telegram bot token from a file. It is mutually exclusive with `bot_token`.
    bot_token_file: z.string().optional(),

    // ID of the chat where to send the messages.
    chat_id: z.number().int().optional(),

    // Message template.
    message: z.string().default('{{ template "telegram.default.message" .}}'),

    // Disable telegram notifications
    disable_notifications: z.boolean().default(false),

    // Parse mode for telegram message, supported values are MarkdownV2, Markdown, HTML and empty string for plain text.
    parse_mode: z.string().default("HTML"),

    http_config: HTTPConfigSpec.optional(),
  })
  .strict()
  .refine(...enforceMutuallyExclusive("bot_token", "bot_token_file", true));

export const VictorOpsConfigSpec = z
  .object({
    // Whether to notify about resolved alerts.
    send_resolved: z.boolean().default(true),

    // The API key to use when talking to the VictorOps API.
    // It is mutually exclusive with `api_key_file`.
    api_key: z.string().optional(),

    // Reads the API key to use when talking to the VictorOps API from a file.
    // It is mutually exclusive with `api_key`.
    api_key_file: z.string().optional(),

    // The VictorOps API URL.
    api_url: z.string().optional(),

    // A key used to map the alert to a team.
    routing_key: z.string(),

    // Describes the behavior of the alert (CRITICAL, WARNING, INFO).
    message_type: z.string().default("CRITICAL"),

    // Contains summary of the alerted problem.
    entire_display_name: z
      .string()
      .default('{{ template "victorops.default.entity_display_name" . }}'),

    // Contains long explanation of the alerted problem.
    state_message: z
      .string()
      .default('{{ template "victorops.default.state_message" . }}'),

    // The monitoring tool the state message is from.
    monitoring_tool: z
      .string()
      .default('{{ template "victorops.default.monitoring_tool" . }}'),

    http_config: HTTPConfigSpec.optional(),
  })
  .strict()
  .refine(...enforceMutuallyExclusive("api_key", "api_key_file"));

export const WebhookConfigSpec = z
  .object({
    // Whether to notify about resolved alerts.
    send_resolved: z.boolean().default(true),

    // The endpoint to send HTTP POST requests to.
    // url and url_file are mutually exclusive.
    url: z.string().optional(),
    url_file: z.string().optional(),

    http_config: HTTPConfigSpec.optional(),

    // The maximum number of alerts to include in a single webhook message. Alerts
    // above this threshold are truncated. When leaving this at its default value of 0, all alerts are included.
    max_alerts: z.number().int().default(0),
  })
  .strict()
  .refine(...enforceMutuallyExclusive("url", "url_file", true));

export const WeChatConfigSpec = z
  .object({
    // Whether to notify about resolved alerts.
    send_resolved: z.boolean().default(false),

    // The API key to use when talking to the WeChat API.
    api_secret: z.string().optional(),

    // The WeChat API URL.
    api_url: z.string().optional(),

    // The corp id for authentication.
    corp_id: z.string().optional(),

    // API request data as defined by the WeChat API.
    message: z.string().default('{{ template "wechat.default.message" . }}'),

    // Type of the message type, supported values are `text` and `markdown`.
    message_type: z.string().default("text"),

    agent_id: z.string().default('{{ template "wechat.default.agent_id" . }}'),
    to_user: z.string().default('{{ template "wechat.default.to_user" . }}'),
    to_party: z.string().default('{{ template "wechat.default.to_party" . }}'),
    to_tag: z.string().default('{{ template "wechat.default.to_tag" . }}'),
  })
  .strict();

export const WebexConfigSpec = z.object({
  // Whether to notify about resolved alerts.
  send_resolved: z.boolean().default(false),

  // The Webex Teams API URL i.e. https://webexapis.com/v1/messages
  // If not specified, default API URL will be used.
  api_url: z.string().optional(),

  // ID of the Webex Teams room where to send the messages.
  room_id: z.string(),

  // Message template.
  message: z.string().default('{{ template "webex.default.message" .}}'),

  http_config: HTTPConfigSpec.optional(),
});

export const ReceiverSpec = z
  .object({
    name: z.string(),
    discord_configs: z.array(DiscordConfigSpec).optional(),
    email_configs: z.array(EmailConfigSpec).optional(),
    msteams_config: z.array(MSTeamsConfigSpec).optional(),
    opsgenie_configs: z.array(OpsGenieConfigSpec).optional(),
    pagerduty_configs: z.array(PagerdutyConfigSpec).optional(),
    pushover_configs: z.array(PushoverConfigSpec).optional(),
    slack_configs: z.array(SlackConfigSpec).optional(),
    sns_configs: z.array(SNSConfigSpec).optional(),
    telegram_configs: z.array(TelegramConfigSpec).optional(),
    victorops_configs: z.array(VictorOpsConfigSpec).optional(),
    webex_configs: z.array(WebexConfigSpec).optional(),
    webhook_configs: z.array(WebhookConfigSpec).optional(),
    wechat_configs: z.array(WeChatConfigSpec).optional(),
  })
  .strict();

export type Receiver = z.infer<typeof ReceiverSpec>;

export const InhibitRuleSpec = z
  .object({
    // DEPRECATED: Use target_matchers below.
    // Matchers that have to be fulfilled in the alerts to be muted.
    target_match: z.record(LabelNameSpec, z.string()).optional(),

    // DEPRECATED: Use target_matchers below.
    target_match_re: z.record(LabelNameSpec, z.string()).optional(),

    // A list of matchers that have to be fulfilled by the target alerts to be muted.
    target_matchers: z.array(MatcherSpec).optional(),

    // DEPRECATED: Use source_matchers below.
    // Matchers for which one or more alerts have to exist for the inhibition to take effect.
    source_match: z.record(LabelNameSpec, z.string()).optional(),

    // DEPRECATED: Use source_matchers below.
    source_match_re: z.record(LabelNameSpec, z.string()).optional(),

    // A list of matchers for which one or more alerts have to exist for the inhibition to take effect.
    source_matchers: z.array(MatcherSpec).optional(),

    // Labels that must have an equal value in the source and target alert for the inhibition to take effect.
    equal: z.array(LabelNameSpec).default([]),
  })
  .strict();

export const TimeSpec = z.string().transform((val) => {
  let parts = val.split(":").map((n) => parseInt(n));
  if (!parts || parts.length !== 2) {
    throw `expected HH:MM`;
  }

  if (parts[0] < 0 || parts[0] >= 24) {
    throw `hour must be between 0-23`;
  }

  if (parts[1] < 0 || parts[1] >= 60) {
    throw `hour must be 0-60`;
  }

  return { hour: parts[0], minute: parts[1] };
});

export const WeekdayRangeSpec = z.string().transform((a) => {
  const days = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];

  if (!a.includes(":")) {
    if (!days.includes(a)) {
      throw `unknown day: ${a}`;
    }

    return { type: "single", day: days.indexOf(a) };
  }

  const parts = a.split(":");
  if (!parts || parts.length != 2) {
    throw "Weekday must be `<day>`, or `<from>:<until>";
  }

  const start = parts[0].toLowerCase();
  const end = parts[1].toLowerCase();
  if (!days.includes(start)) {
    throw `unknown day: ${start}`;
  }

  if (!days.includes(end)) {
    throw `unknown day ${end}`;
  }

  const startIndex = days.indexOf(start);
  const endIndex = days.indexOf(end);
  if (startIndex >= endIndex) {
    throw `start day ${start} must be before end day ${end}`;
  }

  return { type: "range", start: startIndex, end: endIndex };
});

export const DaysOfMonthRange = z.string().transform((a) => {
  if (!a.includes(":")) {
    const num = parseInt(a, 10);
    if (Number.isNaN(num)) {
      throw `expected number: ${a}`;
    }

    if (num === 0) {
      throw `days_of_month_range cannot be 0`;
    }

    return { type: "single", day: num };
  }

  const parts = a.split(":");
  if (!parts || parts.length != 2) {
    throw `days_of_month_range must be <day> or <start>:<end>`;
  }

  const p1 = parseInt(parts[0], 10);
  const p2 = parseInt(parts[1], 10);
  if (Number.isNaN(p1)) {
    throw `days_of_month_range expects a number, not ${p1}`;
  }

  if (p1 === 0 || p2 === 0) {
    throw `days_of_month_range cannot be 0`;
  }

  if (Number.isNaN(p2)) {
    throw `days_of_month_range expects a number, not ${p2}`;
  }

  if (p1 >= p2) {
    throw `days_of_month_range expects ${p1} to be less than ${p2}`;
  }

  return { type: "range", start: p1, end: p2 };
});

export const MonthRange = z.string().transform((a) => {
  const months = [
    "buffer", // Months start at 1, so this makes it easier to calculate indexes.
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ];

  a = a.toLowerCase();
  if (!a.includes(":")) {
    const index = months.indexOf(a);
    const n = index !== -1 ? index : parseInt(a, 10);
    if (n > months.length || n <= 0 || Number.isNaN(n)) {
      throw `month_range expects a month or a number(1-12), not ${a}`;
    }

    return { type: "single", month: n };
  }

  const parts = a.split(":");
  if (!parts || parts.length != 2) {
    throw `month_range expects <start>:<end>`;
  }

  let startIndex = months.indexOf(parts[0]);
  startIndex = startIndex !== -1 ? startIndex : parseInt(parts[0], 10);
  if (
    startIndex > months.length ||
    startIndex <= 0 ||
    Number.isNaN(startIndex)
  ) {
    throw `month_range expects a month or a number(1-12), not ${parts[0]}`;
  }

  let endIndex = months.indexOf(parts[1]);
  endIndex = endIndex !== -1 ? endIndex : parseInt(parts[1], 10);
  if (endIndex > months.length || endIndex <= 0 || Number.isNaN(endIndex)) {
    throw `month_range expects a month or a number(1-12), not ${parts[1]}`;
  }

  return { type: "range", start: startIndex, end: endIndex };
});

export const YearRange = z.string().transform((a) => {
  if (!a.includes(":")) {
    const n = parseInt(a, 10);
    if (Number.isNaN(n)) {
      throw `year_range expects a number, not ${a}`;
    }
    return { type: "single", year: n };
  }

  const parts = a.split(":");
  if (!parts || parts.length != 2) {
    throw `year_range expects <start>:<end>`;
  }

  const p1 = parseInt(parts[0], 10);
  if (Number.isNaN(p1)) {
    throw `year_range expects a number, not ${parts[0]}`;
  }

  const p2 = parseInt(parts[1], 10);
  if (Number.isNaN(p2)) {
    throw `year_range expects a number, not ${parts[1]}`;
  }

  if (p1 >= p2) {
    throw `year_range expects start year (${p1}) to be before the end year ${p2}`;
  }

  return { type: "range", start: p1, end: p2 };
});

export const TimeRangeSpec = z
  .object({
    start_time: TimeSpec,
    end_time: TimeSpec,
  })
  .strict();

export const TimeIntervalSpec = z
  .object({
    name: z.string(),
    time_intervals: z.array(
      z.object({
        times: z.array(TimeRangeSpec).optional(),
        weekdays: z.array(WeekdayRangeSpec).optional(),
        days_of_month: z.array(DaysOfMonthRange).optional(),
        months: z.array(MonthRange).optional(),
        years: z.array(YearRange).optional(),
        location: z.string().default("UTC"), // TODO: Validate this.
      })
    ),
  })
  .strict();

export type TimeInterval = z.infer<typeof TimeIntervalSpec>;

// Walks the given routing tree, running `process` for every encountered node.
export const walkTree = (
  tree: RouteSpec,
  process: (node: RouteSpec, parent?: RouteSpec) => void
) => {
  const to_process: [RouteSpec, RouteSpec | undefined][] = [[tree, undefined]];
  while (to_process.length > 0) {
    const [node, parent] = to_process.pop()!;
    process(node, parent);
    if (node.routes) {
      to_process.push(
        ...node.routes.map((n): [RouteSpec, RouteSpec | undefined] => [n, node])
      );
    }
  }
};

export const GlobalConfigSpec = z
  .object({
    // The default SMTP `from` header field.
    smtp_from: z.string().optional(),

    // The default SMTP smarthost used for sending emails, including port number.
    // Example: smtp.example.org:587
    smtp_smarthost: z.string().optional(),

    // The default hostname to identify to the SMTP server.
    // default: localhost
    smtp_hello: z.string().default("localhost"),

    // // SMTP Auth using CRAM-MD5, LOGIN and PLAIN. If empty, Alertmanager doesn't authenticate to the SMTP server.
    smtp_auth_username: z.string().optional(),

    // SMTP Auth using LOGIN and PLAIN.
    smtp_auth_password: z.string().optional(),
    smtp_auth_password_file: z.string().optional(),

    // SMTP Auth using PLAIN.
    smtp_auth_identity: z.string().optional(),

    // SMTP Auth using CRAM-MD5.
    smtp_auth_secret: z.string().optional(),

    // // The default SMTP TLS requirement.
    smtp_require_tls: z.boolean().default(true),

    slack_api_url: z.string().optional(),
    slack_api_url_file: z.string().optional(),
    victorops_api_key: z.string().optional(),
    victorops_api_key_file: z.string().optional(),
    victorops_api_url: z
      .string()
      .default(
        "https://alert.victorops.com/integrations/generic/20131114/alert/"
      ),
    pagerduty_url: z
      .string()
      .default("https://events.pagerduty.com/v2/enqueue"),
    opsgenie_api_key: z.string().optional(),
    opsgenie_api_key_file: z.string().optional(),
    opsgenie_api_url: z.string().default("https://api.opsgenie.com/"),
    wechat_api_url: z.string().default("https://qyapi.weixin.qq.com/cgi-bin/"),
    wechat_api_secret: z.string().optional(),
    wechat_api_corp_id: z.string().optional(),
    telegram_api_url: z.string().default("https://api.telegram.org"),
    webex_api_url: z.string().default("https://webexapis.com/v1/messages"),
    http_config: HTTPConfigSpec.default(HTTPConfigSpec.parse({})),

    // resolve_timeout is the default value used by alertmanager if the alert does
    // not include EndsAt, after this time passes it can declare the alert as resolved if it has not been updated.
    // This has no impact on alerts from Prometheus, as they always include EndsAt.
    resolve_timeout: z.string().default("5s"),
  })
  .strict();

export const AlertmanagerConfigSpec = z
  .object({
    global: GlobalConfigSpec.default(GlobalConfigSpec.parse({})),
    // Files from which custom notification template definitions are read.
    // The last component may use a wildcard matcher, e.g. 'templates/*.tmpl'.
    templates: z.array(z.string()).default([]),

    // The root node of the routing tree.
    route: RouteConfigSpec,

    // A list of notification receivers.
    receivers: z.array(ReceiverSpec).default([]),

    // A list of inhibition rules.
    inhibit_rules: z.array(InhibitRuleSpec).default([]),

    // DEPRECATED: use time_intervals below.
    // A list of mute time intervals for muting routes.
    mute_time_intervals: z.array(TimeIntervalSpec).default([]),

    // A list of time intervals for muting/activating routes.
    time_intervals: z.array(TimeIntervalSpec).default([]),
  })
  .strict()
  .refine(
    ...enforceMutuallyExclusive("smtp_auth_password", "smtp_auth_password_file")
  )
  .refine(...enforceMutuallyExclusive("slack_api_url", "slack_api_url_file"))
  .refine(
    ...enforceMutuallyExclusive("victorops_api_key", "victorops_api_key_file")
  )
  .refine(
    ...enforceMutuallyExclusive("opsgenie_api_key", "opsgenie_api_key_file")
  )
  .refine(
    (val) =>
      Object.keys(val.route.match).length === 0 &&
      Object.keys(val.route.match_re).length === 0 &&
      val.route.matchers.length === 0,
    `Root of the routing tree must not contain any matchers`
  )
  .superRefine((conf, ctx) => {
    // Make sure that all the receivers in the routing tree exist.
    const existingReceiverNames = conf.receivers.map((r) => r.name);
    let neededReceiverNames: string[] = [];
    conf.route
      ? walkTree(conf.route, (r) =>
          r.receiver ? neededReceiverNames.push(r.receiver) : {}
        )
      : {};

    const missingReceivers = neededReceiverNames.filter(
      (n) => !existingReceiverNames.includes(n)
    );

    if (missingReceivers.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.unrecognized_keys,
        keys: missingReceivers,
        message: `found receiver names that are not defined`,
      });
    }
  })
  .superRefine((conf, ctx) => {
    // Assert that all the receivers etc have unique names.
    const receiver_names: Record<string, z.infer<typeof ReceiverSpec>> = {};
    conf.receivers.forEach((r) => {
      if (receiver_names[r.name]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `receiver ${r.name} is defined multiple times`,
        });
      }

      receiver_names[r.name] = r;
    });

    const time_interval_names: Record<
      string,
      z.infer<typeof TimeIntervalSpec>
    > = {};
    conf.time_intervals.forEach((r) => {
      if (time_interval_names[r.name]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `time interval ${r.name} is defined multiple times`,
        });
      }

      time_interval_names[r.name] = r;
    });
  })
  .transform((conf) => {
    // Walk the routing tree and solidify all the arguments by passing them down.
    walkTree(conf.route, (node, parent) => {
      if (!parent) return;
      node.group_by ??= parent.group_by;
      node.group_wait ??= parent.group_wait;
      node.group_interval ??= parent.group_interval;
      node.repeat_interval ??= parent.repeat_interval;
      node.mute_time_intervals ??= parent.mute_time_intervals;
      node.active_time_intervals ??= parent.active_time_intervals;
    });

    return conf;
  });

export type AlertmanagerConfig = z.infer<typeof AlertmanagerConfigSpec>;
export type RouteConfig = z.infer<typeof RouteConfigSpec>;

export type FlatRouteConfig = Omit<RouteConfig, "routes"> & {
  routes: string[];
};

// collapseRoutingTree takes a nested Alertmanager routing tree and turns it into a flat list of nodes, with an associated ID.
export const collapseRoutingTree = (c: AlertmanagerConfig) => {
  const ids: Map<RouteConfig, string> = new Map();
  const flatNodes: Record<string, FlatRouteConfig> = {};
  const hasParents: Map<string, boolean> = new Map();

  const toProcess = [c.route];
  while (toProcess.length > 0) {
    const node = toProcess.pop()!;
    // We're not at a leaf node, so we need to get the hashes of all our children.
    const childHashes: string[] = [];
    const missing: RouteConfig[] = [];
    if (node.routes) {
      node.routes.forEach((n) => {
        const existingID = ids.get(n);
        if (existingID) {
          hasParents.set(existingID, true);
          childHashes.push(existingID);
        } else {
          missing.push(n);
        }
      });

      if (missing.length > 0) {
        // We have missing children that we need to calculate the ids for. So we push
        // this node, and then all the missing children, so that they will get processed before this node again.
        toProcess.push(node);
        missing.forEach((n) => toProcess.push(n));
        continue;
      }
    }

    const dehydratedNode = { ...node, routes: childHashes };
    const nodeHash = hash(dehydratedNode);
    ids.set(node, nodeHash);
    flatNodes[nodeHash] = dehydratedNode;
  }

  const roots = Object.keys(flatNodes).filter((id) => !hasParents.get(id));
  return { roots: roots, tree: flatNodes };
};
