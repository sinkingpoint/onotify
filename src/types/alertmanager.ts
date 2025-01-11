import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import hash from "object-hash";
import { z, ZodTypeDef } from "zod";
import { Matcher } from "./api";
import { DurationSpec } from "./duration";

extendZodWithOpenApi(z);

// Returns a Zod refinement that rejects the value if the two fields
// are not mutually exclusive.
export const enforceMutuallyExclusive = (
	k1: string,
	k2: string,
	require_one: boolean = false
): [(val: any) => boolean, string] => {
	let msg = `${k1} and ${k2} are mutually exclusive`;
	if (require_one) {
		msg += " and one must exist";
	}
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
		msg,
	];
};

export const TLSConfigSpec = z
	.object({
		// CA certificate to validate the server certificate with.
		ca_file: z.string().optional().openapi({
			description: "the file that contains a CA cert to verify requests with",
		}),

		// Certificate and key files for client cert authentication to the server.
		cert_file: z.string().optional().openapi({
			description: "the file that contains the client cert to present when making requests",
		}),
		key_file: z.string().optional().openapi({
			description: "the file that contains the private key to use when making requests",
		}),

		// ServerName extension to indicate the name of the server.
		server_name: z.string().optional().openapi({
			description: "the server name to present when doing client authentication",
		}),

		// Disable validation of the server certificate.
		insecure_skip_verify: z.boolean().default(false).openapi({
			description: "if true, don't validate the presented server certificate",
		}),
		min_version: z.string().optional().openapi({ description: "the minimum version of TLS to support" }),
		max_version: z.string().optional().openapi({ description: "the maximum version of TLS to support" }),
	})
	.strict()
	.openapi({ description: "configure TLS when making requests" });

export const OAuth2ConfigSpec = z
	.object({
		client_id: z.string().openapi({ description: "the client ID to present" }),
		client_secret: z.string().optional().openapi({ description: "the client secret to present" }),
		// Read the client secret from a file.
		// It is mutually exclusive with `client_secret`.
		client_secret_file: z.string().optional().openapi({
			description: "the file that contains the client secret to present. Mutually exclusive with `client_secret",
		}),

		// Scopes for the token request.
		scopes: z.array(z.string()).default([]).openapi({ description: "the scopes for the token request" }),

		// The URL to fetch the token from.
		token_url: z.string().openapi({ description: "the URL to fetch the token from" }),

		// Optional parameters to append to the token URL.
		endpoint_params: z.array(z.string()).default([]).openapi({
			description: "Optional parameters to append to the token URL",
		}),

		// Configures the token request's TLS settings.
		tls_config: TLSConfigSpec.default({ insecure_skip_verify: false }).openapi({
			description: "Configures the token requests TLS settings",
		}),

		// Optional proxy URL.
		proxy_url: z.string().optional().openapi({ description: "Optional proxy URL" }),

		// Comma-separated string that can contain IPs, CIDR notation, domain names
		// that should be excluded from proxying. IP and domain names can contain port numbers.
		no_proxy: z.string().optional().openapi({
			description:
				"Comma-seperated string that can contain IPs, CIDR notation, domain names that should be excluded from proxying. IP and domain names can contain port numbers.",
		}),

		// Use proxy URL indicated by environment variables (HTTP_PROXY, https_proxy, HTTPs_PROXY, https_proxy, and no_proxy)
		proxy_from_environment: z.boolean().default(false).openapi({
			description: "Use proxy URL indicated by environment variables",
		}),

		// Specifies headers to send to proxies during CONNECT requests.
		proxy_connect_header: z.record(z.string(), z.array(z.string())).openapi({
			description: "Specifies headers to send to proxies during CONNECT requests",
		}),
	})
	.strict()
	.refine(...enforceMutuallyExclusive("client_secret", "client_secret_file", true))
	.openapi({
		description: "configure using OAuth2 to authenticate to a server",
	});

export const HTTPConfigSpec = z
	.object({
		// Sets the `Authorization` header with the configured username and password.
		// password and password_file are mutually exclusive.
		basic_auth: z
			.object({
				username: z.string().openapi({ description: "the username to present" }),
				password: z.string().optional().openapi({ description: "the password to use in basic auth" }),
				password_file: z.string().optional().openapi({ description: "the file to load the password from" }),
			})
			.optional()
			.refine(...enforceMutuallyExclusive("password", "password_file"))
			.openapi({
				description: "Sets the `Authorization` header with the configured username and password",
			}),
		// Optional the `Authorization` header configuration.
		authorization: z
			.object({
				// Sets the authentication type.
				type: z.string().default("Bearer").openapi({ description: "the authentication type" }),
				// Sets the credentials. It is mutually exclusive with `credentials_file`.
				credentials: z.string().optional().openapi({ description: "the credendials to present" }),

				// Sets the credentials with the credentials read from the configured file.
				// It is mutually exclusive with `credentials`.
				credentials_file: z.string().optional().openapi({ description: "the file to load the credentials from" }),
			})
			.optional()
			.refine(...enforceMutuallyExclusive("credentials", "credentials_file"))
			.openapi({
				description: "optional `Authorization` header configuration",
			}),
		// Optional OAuth 2.0 configuration.
		// Cannot be used at the same time as basic_auth or authorization.
		oauth2: OAuth2ConfigSpec.optional(),
		// Whether to enable HTTP2.
		enable_http2: z.boolean().default(true).openapi({ description: "if true, send requests with HTTP2" }),
		// Optional proxy URL.
		proxy_url: z.string().optional().openapi({ description: "the url to use to proxy requests" }),

		// Comma-separated string that can contain IPs, CIDR notation, domain names
		// that should be excluded from proxying. IP and domain names can
		// contain port numbers.
		no_proxy: z.string().optional().openapi({
			description:
				"comma-seperated string that can contain IPs, CIDR notation, domain names that should be excluded from proxying. IP and domain names can contain port numbers",
		}),

		// Use proxy URL indicated by environment variables (HTTP_PROXY, http_proxy, HTTPS_PROXY, https_proxy, NO_PROXY, and no_proxy)
		proxy_from_environment: z.boolean().default(false).openapi({
			description: "Use proxy URL indicated by environment variables",
		}),

		// Specifies headers to send to proxies during CONNECT requests.
		proxy_connect_header: z.record(z.string(), z.array(z.string())).default({}).openapi({
			description: "Specifies headers to send to proxies during CONNECT requests",
		}),

		// Configure whether HTTP requests follow HTTP 3xx redirects.
		follow_redirects: z.boolean().default(true).openapi({ description: "if true, follow HTTP 3xx redirects" }),

		// Configures the TLS settings.
		tls_config: TLSConfigSpec.default(TLSConfigSpec.parse({})),
	})
	.strict()
	.refine(...enforceMutuallyExclusive("basic_auth", "authorization"))
	.openapi({
		description: "settings to configure the behaviour of HTTP requests",
	});

export const LabelNameSpec = z
	.string()
	.refine((val) => {
		return val.match(/^[^{}!=~,\\"'`\s]+$/);
	}, "label_name must match `/^[^{}!=~,\\\"'`\\s]+$/`")
	.openapi({ description: "a label name" });

// Unquote the given string, removing a matching ', ", or ` from the start and end of the string.
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

export const StringMatcherSpec = z
	.string()
	.transform((val): Matcher => {
		const parts = val.match(/^([^{}!=~,\\"'`\s]+)(=|!=|=~|!~)(".+")$/);

		if (!parts || parts.length != 4) {
			throw `expected a valid matcher, not ${val}`;
		}

		const [_, labelName, matcher, rawValue] = parts;

		const isEqual = matcher === "=" || matcher === "=~";
		const isRegex = matcher === "=~" || matcher === "!~";
		let value = unquote(rawValue);
		if (isRegex && !value.startsWith("^")) {
			value = `^${value}`;
		}

		return {
			name: labelName,
			value: unquote(rawValue),
			isEqual,
			isRegex,
		};
	})
	.openapi({
		description: "a matcher to match labels against",
		examples: [`a="b"`, `a!="b"`, `a=~"b"`, `a!~"b"`],
	});

const baseRouteSpec = z
	.object({
		receiver: z.string().optional().openapi({ description: "the receier to send alerts to" }),
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
		group_by: z.array(z.string()).optional().openapi({
			description: "The labels by which incoming alerts are grouped together",
		}),

		// Whether an alert should continue matching subsequent sibling nodes.
		continue: z.boolean().default(false).openapi({
			description: "If true, any alerts that hit this node will continue matching other nodes along the tree",
		}),

		// DEPRECATED: Use matchers below.
		// A set of equality matchers an alert has to fulfill to match the node.
		match: z.record(z.string(), z.string()).default({}).openapi({
			description: "A set of equality matchers that an alert has to fulfull to match the node",
			deprecated: true,
		}),

		// DEPRECATED: Use matchers below.
		// A set of regex-matchers an alert has to fulfill to match the node.
		match_re: z.record(z.string(), z.string()).default({}).openapi({
			description: "A set of regex matchers that an alert has to fulfull to match the node",
			deprecated: true,
		}),

		// A list of matchers that an alert has to fulfill to match the node.
		matchers: z.array(StringMatcherSpec).default([]).openapi({
			description: "A list of matchers than an alert has to fulfill to match the node",
		}),

		// How long to initially wait to send a notification for a group
		// of alerts. Allows to wait for an inhibiting alert to arrive or collect
		// more initial alerts for the same group. (Usually ~0s to few minutes.)
		// If omitted, child routes inherit the group_wait of the parent route.
		group_wait: DurationSpec.default("30s").openapi({
			description: "How long to initially wait to send a notification for a group",
		}),

		// How long to wait before sending a notification about new alerts that
		// are added to a group of alerts for which an initial notification has
		// already been sent. (Usually ~5m or more.) If omitted, child routes
		// inherit the group_interval of the parent route.
		group_interval: DurationSpec.default("5m").openapi({
			description:
				"How long to wait before sending a notification about new alerts that are added to an existing group of alerts",
		}),

		// How long to wait before sending a notification again if it has already
		// been sent successfully for an alert. (Usually ~3h or more). If omitted,
		// child routes inherit the repeat_interval of the parent route.
		// Note that this parameter is implicitly bound by Alertmanager's
		// `--data.retention` configuration flag. Notifications will be resent after either
		// repeat_interval or the data retention period have passed, whichever
		// occurs first. `repeat_interval` should be a multiple of `group_interval`.
		repeat_interval: DurationSpec.default("4h").openapi({
			description: "How long to wait before resending notifications for alerts that are still active",
		}),

		// Times when the route should be muted. These must match the name of a
		// mute time interval defined in the mute_time_intervals section.
		// Additionally, the root node cannot have any mute times.
		// When a route is muted it will not send any notifications, but
		// otherwise acts normally (including ending the route-matching process
		// if the `continue` option is not set.)
		mute_time_intervals: z.array(z.string()).default([]).openapi({
			description:
				"Times when the route should be muted. These must match the name of a mute time interval defined in the mute_time_intervals section",
		}),

		// Times when the route should be active. These must match the name of a
		// time interval defined in the time_intervals section. An empty value
		// means that the route is always active.
		// Additionally, the root node cannot have any active times.
		// The route will send notifications only when active, but otherwise
		// acts normally (including ending the route-matching process
		// if the `continue` option is not set).
		active_time_intervals: z.array(z.string()).default([]).openapi({
			description:
				"Times when the route should be active. These must match the name of a time interval defined in the time_intervals section.",
		}),
	})
	.strict();

type inRouteSpec = z.input<typeof baseRouteSpec> & {
	routes?: inRouteSpec[];
};

type outRouteSpec = z.output<typeof baseRouteSpec> & {
	routes?: outRouteSpec[];
};

type RouteSpec = outRouteSpec;

export const RouteConfigSpec: z.ZodType<outRouteSpec, ZodTypeDef, inRouteSpec> = baseRouteSpec
	.extend({
		routes: z
			.lazy(() => RouteConfigSpec.array())
			.optional()
			.openapi({
				type: "array",
				items: {
					type: "object",
				},
				description: "the routes below this one in the tree",
			}),
	})
	.strict()
	.openapi({ description: "a route to send alerts" });

export const DiscordConfigSpec = z
	.object({
		// Whether to notify about resolved alerts.
		send_resolved: z.boolean().default(true).openapi({ description: "whether to notify about resolved alerts" }),

		// The Discord webhook URL.
		// webhook_url and webhook_url_file are mutually exclusive.
		webhook_url: z.string().optional().openapi({ description: "the discord webhook URL" }),
		webhook_url_file: z.string().optional().openapi({ description: "the file to load the discord webhook URL" }),

		// Message title template.
		title: z
			.string()
			.default('{{ template "discord.default.title" . }}')
			.optional()
			.openapi({ description: "the template to use for the message title" }),
		message: z
			.string()
			.default('{{ template "discord.default.message" . }}')
			.openapi({ description: "the template to use for the message body" }),
		http_config: HTTPConfigSpec.optional(),
	})
	.strict()
	.refine(...enforceMutuallyExclusive("webhook_url", "webhook_url_file", true))
	.openapi({ description: "configuration for sending alerts to discord" });

export const EmailConfigSpec = z
	.object({
		// Whether to notify about resolved alerts.
		send_resolved: z.boolean().default(false).openapi({ description: "whether to notify about resolved alerts" }),

		// The email address to send notifications to.
		to: z.string().openapi({ description: "the email address to send notification to" }),

		// The sender's address.
		from: z.string().optional().openapi({ description: "the senders address" }),

		// The SMTP host through which emails are sent.
		smarthost: z.string().optional().openapi({ description: "The SMTP host through which emails are sent" }),

		// The hostname to identify to the SMTP server.
		hello: z.string().optional().openapi({ description: "the hostname to identify to the SMTP server" }),

		// SMTP authentication information.
		// auth_password and auth_password_file are mutually exclusive.
		auth_username: z.string().optional().openapi({
			description: "the username to use to authenticate to the SMTP server",
		}),
		auth_password: z.string().optional().openapi({
			description: "the pass to use to authenticate to the SMTP server",
		}),
		auth_password_file: z.string().optional().openapi({
			description: "the file from which to load the password to use to authenticate to the SMTP server",
		}),
		auth_secret: z.string().optional().openapi({
			description: "the auth secret to use when authenticating to the SMTP server",
		}),
		auth_identity: z.string().optional().openapi({
			description: "the auth identity to use when authenticating to the SMTP server",
		}),

		// The SMTP TLS requirement.
		// Note that Go does not support unencrypted connections to remote SMTP endpoints.
		require_tls: z.boolean().optional().openapi({
			description: "if true, enforce that we require TLS when talking to the SMTP server",
		}),

		tls_config: TLSConfigSpec.optional(),

		html: z.string().optional().openapi({
			description: "the template to use when generating an HTML email",
		}),
		text: z.string().optional().openapi({
			description: "the template to use when generating an text email",
		}),
		headers: z
			.record(z.string(), z.string())
			.default({})
			.openapi({ description: "the headers to send to the SMTP server" }),
	})
	.strict()
	.refine(...enforceMutuallyExclusive("auth_password", "auth_password_file"))
	.refine(...enforceMutuallyExclusive("html", "text", false))
	.openapi({
		description: "configuration to use when sending alerts via email",
	});

export const MSTeamsConfigSpec = z
	.object({
		// Whether to notify about resolved alerts.
		send_resolved: z.boolean().default(true).openapi({ description: "whether to notify about resolved alerts" }),

		// The incoming webhook URL.
		// webhook_url and webhook_url_file are mutually exclusive.
		webhook_url: z.string().optional().openapi({ description: "the incoming webhook URL" }),
		webhook_url_file: z.string().optional().openapi({ description: "the file to load the incoming webhook from" }),

		// Message title template.
		title: z
			.string()
			.default('{{ template "msteams.default.title" . }}')
			.openapi({ description: "the template to use for the message title" }),
		// Message summary template.
		summary: z
			.string()
			.default('{{ template "msteams.default.summary" . }}')
			.openapi({ description: "the template to use for the message summary" }),
		// Message body template.
		text: z
			.string()
			.default('{{ template "msteams.default.text" . }}')
			.openapi({ description: "the template to use for the message body" }),
		// The HTTP client's configuration.
		http_config: HTTPConfigSpec.optional(),
	})
	.strict()
	.refine(...enforceMutuallyExclusive("webhook_url", "webhook_url_file", true))
	.openapi({ description: "configuration to use to send alerts to MS Teams" });

export const OpsGenieRespondersSpec = z
	.object({
		id: z.string().optional().openapi({ description: "the ID of the responder to send to" }),
		name: z.string().optional().openapi({ description: "the name of the responder to send to" }),
		username: z.string().optional().openapi({ description: "the username of the responder to send to" }),
		type: z.string().openapi({ description: "the type of the responder to send to" }),
	})
	.strict()
	.openapi({ description: "an Ops Genie responder to send alerts to" });

export const OpsGenieConfigSpec = z
	.object({
		// Whether to notify about resolved alerts.
		send_resolved: z.boolean().default(true).openapi({ description: "whether to notify about resolved alerts" }),

		// The API key to use when talking to the OpsGenie API.
		api_key: z.string().optional().openapi({
			description: "the API key to use when talking to the OpsGenie API",
		}),

		// The filepath to API key to use when talking to the OpsGenie API. Conflicts with api_key.
		api_key_file: z.string().optional().openapi({
			description: "the file to load the API key to use when talking to the OpsGenie API",
		}),

		// The host to send OpsGenie API requests to.
		api_url: z.string().optional().openapi({
			description: "the API URL to use when talking to the OpsGenie API",
		}),

		// Alert text limited to 130 characters.
		message: z.string().default('{{ template "opsgenie.default.message" . }}').openapi({
			description: "the template to use for the alert message",
		}),

		// A description of the alert.
		description: z.string().default('{{ template "opsgenie.default.description" . }}').openapi({
			description: "the template to use for the alert description",
		}),

		// A backlink to the sender of the notification.
		source: z.string().default('{{ template "opsgenie.default.source" . }}').openapi({
			description: "a template to use for the backlink to the sender of the alert",
		}),

		// A set of arbitrary key/value pairs that provide further detail about the alert.
		// All common labels are included as details by default.
		details: z.record(z.string(), z.string()).optional().openapi({
			description: "a set of arbitrary key/value pairs that provide further details about the alert",
		}),

		// List of responders responsible for notifications.
		responders: OpsGenieRespondersSpec.array().default([]),

		// Comma separated list of tags attached to the notifications.
		tags: z.string().optional().openapi({
			description: "comma seperated list of tags attached to notifications",
		}),

		// Additional alert note.
		note: z.string().optional().openapi({
			description: "additional alert note",
		}),

		// Priority level of alert. Possible values are P1, P2, P3, P4, and P5.
		priority: z.enum(["P1", "P2", "P3", "P4", "P5"]).optional().openapi({
			description: "priority level of the alert",
		}),

		// Whether to update message and description of the alert in OpsGenie if it already exists
		// By default, the alert is never updated in OpsGenie, the new message only appears in activity log.
		update_alerts: z.boolean().default(false).openapi({
			description: "whether to update the message and description of the alert in OpsGenic if it already exists",
		}),

		// Optional field that can be used to specify which domain alert is related to.
		entity: z.string().optional().openapi({
			description: "optional field that cna be used to specify which domain alert is related to",
		}),

		// Comma separated list of actions that will be available for the alert.
		actions: z.string().optional().openapi({
			description: "Comma seperated list of actions that will be available for the alert",
		}),

		http_config: HTTPConfigSpec.optional(),
	})
	.strict()
	.refine(...enforceMutuallyExclusive("api_key", "api_key_file", true))
	.openapi({
		description: "configurations to use when sending alerts to OpsGenie",
	});

export const PagerdutyImageConfigSpec = z
	.object({
		href: z.string().optional().openapi({
			description: "Optional URL; makes the image a clickable link.",
		}),
		src: z.string().optional().openapi({
			description: "The source (URL) of the image being attached to the incident. This image must be served via HTTPS.",
		}),
		alt: z.string().optional().openapi({
			description: "The alt text of the image",
		}),
	})
	.strict()
	.openapi({
		description: "an image to attach to the pagerduty alert",
	});

export const PagerdutyLinkConfigSpec = z
	.object({
		href: z.string().optional().openapi({ description: "URL of the link to be attached." }),
		text: z.string().optional().openapi({
			description: "Plain text that describes the purpose of the link, and can be used as the link's text.",
		}),
	})
	.strict()
	.openapi({
		description: "an link to attach to the pagerduty alert",
	});

export const PagerdutyConfigSpec = z
	.object({
		// Whether to notify about resolved alerts.
		send_resolved: z.boolean().default(true).openapi({ description: "whether to notify about resolved alerts" }),

		// The routing and service keys are mutually exclusive.
		// The PagerDuty integration key (when using PagerDuty integration type `Events API v2`).
		// It is mutually exclusive with `routing_key_file`.
		routing_key: z.string().optional().openapi({ description: "the routing key to use when sending alerts" }),

		// Read the Pager Duty routing key from a file.
		// It is mutually exclusive with `routing_key`.
		routing_key_file: z.string().optional().openapi({
			description: "the file from which to load the routing key to use when sending alerts",
		}),

		// The PagerDuty integration key (when using PagerDuty integration type `Prometheus`).
		// It is mutually exclusive with `service_key_file`.
		service_key: z.string().optional().openapi({
			description: "The PagerDuty integration key (when using PagerDuty integration type `Prometheus`).",
		}),

		// Read the Pager Duty service key from a file.
		// It is mutually exclusive with `service_key`.
		service_key_file: z.string().optional().openapi({
			description: "the file from which to load the routing key to use when sending alerts",
		}),

		// The URL to send API requests to
		url: z.string().optional().openapi({ description: "the URL to send API requests to" }),

		// The client identification of the Alertmanager.
		client: z.string().default('{{ template "pagerduty.default.client" . }}').openapi({
			description: "the template to use for the client identication of the Alertmanager",
		}),

		//  A backlink to the sender of the notification.
		client_url: z.string().default('{{ template "pagerduty.default.clientURL" . }}').openapi({
			description: "the template to use for the backlink to the sender of the notification",
		}),

		// A description of the incident.
		description: z.string().default('{{ template "pagerduty.default.description" .}}').openapi({
			description: "the template to use for the description of the incident",
		}),

		// Severity of the incident.
		severity: z.enum(["critical", "error", "warning", "lite"]).default("error").openapi({
			description: "the severity of the incident",
		}),

		// Unique location of the affected system.
		source: z.string().default("client").openapi({ description: "unique location of the affected system" }),

		// A set of arbitrary key/value pairs that provide further detail about the incident.
		details: z
			.record(z.string(), z.string())
			.default({
				firing: '{{ template "pagerduty.default.instances" .Alerts.Firing }}',
				resolved: '{{ template "pagerduty.default.instances" .Alerts.Resolved }}',
				num_firing: "{{ .Alerts.Firing | len }}",
				num_resolved: "{{ .Alerts.Resolved | len }}",
			})
			.openapi({
				description: "A set of arbitrary KV pair that provide further detail about the incident.",
			}),

		// Images to attach to the incident.
		images: z.array(PagerdutyImageConfigSpec).default([]),

		// Links to attach to the incident.
		links: z.array(PagerdutyLinkConfigSpec).default([]),

		// The part or component of the affected system that is broken.
		component: z.string().optional().openapi({
			description: "the part or component of the affected system that is broken",
		}),

		// A cluster or grouping of sources.
		group: z.string().optional().openapi({ description: "a cluster or grouping of services" }),

		// The class/type of the event.
		class: z.string().optional().openapi({ description: "the class/type of the event" }),

		http_config: HTTPConfigSpec.optional(),
	})
	.strict()
	.refine(...enforceMutuallyExclusive("routing_key", "routing_key_file"))
	.refine(...enforceMutuallyExclusive("service_key", "service_key_file"))
	.openapi({
		description: "configurations to use when sending alerts to pagerduty",
	});

export const PushoverConfigSpec = z
	.object({
		// Whether to notify about resolved alerts.
		send_resolved: z.boolean().default(true).openapi({ description: "whether to notify about resolved alerts" }),

		// The recipient user's key.
		// user_key and user_key_file are mutually exclusive.
		user_key: z.string().optional().openapi({ description: "the recipient users key" }),
		user_key_file: z.string().optional().openapi({
			description: "the file to load the recipient users key from",
		}),

		// Your registered application's API token, see https://pushover.net/apps
		// You can also register a token by cloning this Prometheus app:
		// https://pushover.net/apps/clone/prometheus
		// token and token_file are mutually exclusive.
		token: z.string().optional().openapi({ description: "the registered applications API token" }),
		token_file: z.string().optional().openapi({
			description: "the  file to load the registered applications API token from",
		}),

		// Notification title.
		title: z.string().default('{{ template "pushover.default.title" . }}').openapi({
			description: "the  template to use for the notification title",
		}),

		// Notification message
		message: z.string().default('{{ template "pushover.default.message" . }}').openapi({
			description: "the  template to use for the notification message",
		}),

		// A supplementary URL shown alongside the message.
		url: z.string().default('{{ template "pushover.default.url" . }}').openapi({
			description: "the  template to use for a supplementary URL shown alongside the message",
		}),

		// Optional device to send notification to, see https://pushover.net/api#device
		device: z.string().optional().openapi({
			description: "optional device to send notification to",
		}),

		// Optional sound to use for notification, see https://pushover.net/api#sound
		sound: z.string().optional().openapi({
			description: "optional sound to use for the notification",
		}),

		// Priority, see https://pushover.net/api#priority
		priority: z.string().default('{{ if eq .Status "firing" }}2{{ else }}0{{ end }}').openapi({
			description: "the template to use for the priority of the alert",
		}),

		// How often the Pushover servers will send the same notification to the user.
		// Must be at least 30 seconds.
		retry: DurationSpec.default("1m").openapi({
			description: "how often the pushover servers will send the same notification to the user",
		}),

		// How long your notification will continue to be retried for, unless the user acknowledges the notification.
		expire: DurationSpec.default("1h").openapi({
			description:
				"how long your notification will continue to be retried for, unless the user acknowledges the notification",
		}),

		// Optional time to live (TTL) to use for notification, see https://pushover.net/api#ttl
		ttl: DurationSpec.optional(),

		http_config: HTTPConfigSpec.optional(),
	})
	.strict()
	.refine(...enforceMutuallyExclusive("user_key", "user_key_file", true))
	.refine(...enforceMutuallyExclusive("token", "token_file", true))
	.openapi({
		description: "configurations to use when sending alerts to PushOver",
	});

export const SlackActionConfirmFieldConfigSpec = z
	.object({
		text: z.string().openapi({ description: "the text of the action" }),
		dismiss_text: z.string().default("").openapi({ description: "the text of the dismiss action" }),
		ok_text: z.string().default("").openapi({ description: "the text of the ok action" }),
		title: z.string().default("").openapi({ description: "the text of the title" }),
	})
	.strict()
	.openapi({
		description: "configuration options for a confirm slack operation",
	});

export const SlackActionConfigSpec = z
	.object({
		text: z.string().openapi({ description: "the text for the action" }),
		type: z.string().openapi({ description: "the type of the action" }),
		// Either url or name and value are mandatory.
		url: z.string().optional().openapi({ description: "the URL to trigger the action" }),
		name: z.string().optional().openapi({ description: "the name of the action" }),
		value: z.string().optional(),

		confirm: SlackActionConfirmFieldConfigSpec.optional().openapi({
			description: "configurations for confirming the action",
		}),
		style: z.string().default("").openapi({ description: "the style to apply to the action" }),
	})
	.strict()
	.openapi({ description: "configuration options for slack action buttons" });

export const SlackFieldConfigSpec = z
	.object({
		title: z.string().openapi({ description: "the name of the field" }),
		value: z.string().openapi({ description: "the value for the action" }),
		short: z.boolean().optional().openapi({ description: "TODO" }),
	})
	.strict()
	.openapi({
		description: "configuration options for fields in a slack message",
	});

export const SlackConfigSpec = z
	.object({
		// Whether to notify about resolved alerts.
		send_resolved: z.boolean().default(false).openapi({ description: "whether to notify about resolved alerts" }),

		// The Slack webhook URL. Either api_url or api_url_file should be set.
		// Defaults to global settings if none are set here.
		api_url: z.string().optional().openapi({ description: "the slack webhook URL" }),
		api_url_file: z.string().optional().openapi({ description: "the file to load the slack webhook URL from" }),

		// The channel or user to send notifications to.
		channel: z.string().openapi({ description: "the channel to send alerts to" }),

		// API request data as defined by the Slack webhook API.
		icon_emoji: z.string().optional().openapi({ description: "an emoji to use as the icon" }),
		icon_url: z.string().optional().openapi({ description: "a url to the icon to use for the alert" }),
		link_names: z.boolean().default(false).openapi({ description: "if true, link any @'s in the message" }),
		username: z.string().default('{{ template "slack.default.username" . }}').openapi({
			description: "a template that indicates the username to use",
		}),

		// The following parameters define the attachment.
		actions: z.array(SlackActionConfigSpec).default([]),
		callback_id: z.string().default('{{ template "slack.default.callbackid" . }}').openapi({
			description: "a template that indicates the callback to call",
		}),
		color: z.string().default('{{ if eq .Status "firing" }}danger{{ else }}good{{ end }}').openapi({
			description: "a template that indicates the color to use for the alert",
		}),
		fallback: z.string().default('{{ template "slack.default.fallback" . }}').openapi({
			description: "a fallback message displayed in notifications",
		}),
		fields: z.array(SlackFieldConfigSpec).default([]).openapi({ description: "the fields of the message" }),
		footer: z
			.string()
			.default('{{ template "slack.default.footer" . }}')
			.openapi({ description: "the message displayed in the footer" }),
		mrkdwn_in: z.array(z.string()).default(["fallback", "pretext", "text"]).openapi({ description: "" }),
		pretext: z.string().default('{{ template "slack.default.pretext" . }}').openapi({ description: "" }),
		short_fields: z.boolean().default(false).openapi({ description: "" }),
		text: z.string().default('{{ template "slack.default.text" . }}').openapi({ description: "" }),
		title: z.string().default('{{ template "slack.default.title" . }}').openapi({ description: "" }),
		title_link: z.string().default('{{ template "slack.default.titlelink" . }}').openapi({ description: "" }),
		image_url: z.string().optional().openapi({ description: "" }),
		thumb_url: z.string().optional().openapi({ description: "" }),

		http_config: HTTPConfigSpec.optional(),
	})
	.strict()
	.refine(...enforceMutuallyExclusive("api_url", "api_url_file", true))
	.openapi({
		description: "configuration options for messages sent to slack",
	});

export const AWSSigv4ConfigSpec = z
	.object({
		// The AWS region. If blank, the region from the default credentials chain is used.
		region: z.string().openapi({ description: "The AWS region. Cannot be blank" }),

		// The AWS API keys. Both access_key and secret_key must be supplied or both must be blank.
		access_key: z.string().optional().openapi({
			description: "The AWS API access key. Both access_key and secret_key must be supplied.",
		}),
		secret_key: z.string().optional().openapi({
			description: "The AWS API secret key. Both access_key and secret_key must be supplied.",
		}),

		// Named AWS profile used to authenticate.
		profile: z.string().optional().openapi({ description: "Named AWS profile used to authenticate." }),

		// AWS Role ARN, an alternative to using AWS API keys.
		role_arn: z.string().optional().openapi({ description: "AWS Role ARN, an alternative to using AWS API keys." }),
	})
	.strict()
	.openapi({
		description: "configuration options for authenticating with AWS",
	});

export const SNSConfigSpec = z
	.object({
		// Whether to notify about resolved alerts.
		send_resolved: z.boolean().default(true).openapi({ description: "whether to notify about resolved alerts" }),

		// The SNS API URL i.e. https://sns.us-east-2.amazonaws.com.
		api_url: z.string().openapi({ description: "The SNS API URL e.g. https://sns.us-east-2.amazonaws.com" }),

		// Configures AWS's Signature Verification 4 signing process to sign requests.
		sigv4: AWSSigv4ConfigSpec.openapi({
			description: "Configures AWS's Signature Verification 4 signing process to sign requests.",
		}),

		// SNS topic ARN, i.e. arn:aws:sns:us-east-2:698519295917:My-Topic
		// If you don't specify this value, you must specify a value for the phone_number or target_arn.
		// If you are using a FIFO SNS topic you should set a message group interval longer than 5 minutes
		// to prevent messages with the same group key being deduplicated by the SNS default deduplication window
		topic_arn: z
			.string()
			.optional()
			.openapi({ description: "SNS topic ARN, e.g. arn:aws:sns:us-east-2:698519295917:My-Topic" }),

		// Subject line when the message is delivered to email endpoints.
		subject: z
			.string()
			.default('{{ template "sns.default.subject" .}}')
			.openapi({ description: "Subject line when the message is delivered to email endpoints." }),

		// Phone number if message is delivered via SMS in E.164 format.
		// If you don't specify this value, you must specify a value for the topic_arn or target_arn.
		phone_number: z
			.string()
			.optional()
			.openapi({ description: "Phone number if message is delivered via SMS in E.164 format." }),

		// The mobile platform endpoint ARN if message is delivered via mobile notifications.
		// If you don't specify this value, you must specify a value for the topic_arn or phone_number.
		target_arn: z
			.string()
			.optional()
			.openapi({ description: "The mobile platform endpoint ARN if message is delivered via mobile notifications." }),

		// The message content of the SNS notification.
		message: z
			.string()
			.default('{{ template "sns.default.message" .}}')
			.openapi({ description: "The message content of the SNS notification." }),

		// SNS message attributes.
		attributes: z.record(z.string(), z.string()).default({}).openapi({ description: "SNS message attributes." }),

		// The HTTP client's configuration.
		http_config: HTTPConfigSpec.optional(),
	})
	.strict()
	.openapi({ description: "configuration options for sending messages to AWS SNS" });

export const TelegramConfigSpec = z
	.object({
		// Whether to notify about resolved alerts.
		send_resolved: z.boolean().default(true).openapi({ description: "whether to notify about resolved alerts" }),

		// The Telegram API URL e.g. https://api.telegram.org.
		// If not specified, default API URL will be used.
		api_url: z.string().optional().openapi({
			description:
				"The Telegram API URL e.g. https://api.telegram.org. If not specified, default API URL will be used.",
		}),

		// Telegram bot token. It is mutually exclusive with `bot_token_file`.
		bot_token: z.string().optional().openapi({
			description: "Telegram bot token. It is mutually exclusive with `bot_token_file`.",
		}),

		// Read the Telegram bot token from a file. It is mutually exclusive with `bot_token`.
		bot_token_file: z.string().optional().openapi({
			description: "Read the Telegram bot token from a file. It is mutually exclusive with `bot_token`.",
		}),

		// ID of the chat where to send the messages.
		chat_id: z.number().int().optional().openapi({
			description: "ID of the chat where to send the messages.",
		}),

		// Message template.
		message: z.string().default('{{ template "telegram.default.message" .}}').openapi({
			description: "Message template.",
		}),

		// Disable telegram notifications
		disable_notifications: z.boolean().default(false).openapi({
			description: "Whether or not to disable telegram notifications",
		}),

		// Parse mode for telegram message, supported values are MarkdownV2, Markdown, HTML and empty string for plain text.
		parse_mode: z.enum(["MarkdownV2", "Markdown", "HTML", ""]).default("HTML").openapi({
			description:
				"Parse mode for telegram message, supported values are MarkdownV2, Markdown, HTML and empty string for plain text.",
		}),

		http_config: HTTPConfigSpec.optional(),
	})
	.strict()
	.refine(...enforceMutuallyExclusive("bot_token", "bot_token_file", true))
	.openapi({
		description: "Configuration options for sending messages to telegram",
	});

export const VictorOpsConfigSpec = z
	.object({
		// Whether to notify about resolved alerts.
		send_resolved: z.boolean().default(true).openapi({ description: "whether to notify about resolved alerts" }),

		// The API key to use when talking to the VictorOps API.
		// It is mutually exclusive with `api_key_file`.
		api_key: z.string().optional().openapi({
			description:
				"The API key to use when talking to the VictorOps API. It is mutually exclusive with `api_key_file`.",
		}),

		// Reads the API key to use when talking to the VictorOps API from a file.
		// It is mutually exclusive with `api_key`.
		api_key_file: z.string().optional().openapi({
			description:
				"Reads the API key to use when talking to the VictorOps API from a file. It is mutually exclusive with `api_key`.",
		}),

		// The VictorOps API URL.
		api_url: z.string().optional().openapi({
			description: "The VictorOps API URL.",
		}),

		// A key used to map the alert to a team.
		routing_key: z.string().openapi({ description: "A key used to map the alert to a team." }),

		// Describes the behavior of the alert (CRITICAL, WARNING, INFO).
		message_type: z
			.enum(["CRITICAL", "WARNING", "INFO"])
			.default("CRITICAL")
			.openapi({ description: "Describes the behavior of the alert (CRITICAL, WARNING, INFO)." }),

		// Contains summary of the alerted problem.
		entire_display_name: z
			.string()
			.default('{{ template "victorops.default.entity_display_name" . }}')
			.openapi({ description: "Contains summary of the alerted problem." }),

		// Contains long explanation of the alerted problem.
		state_message: z
			.string()
			.default('{{ template "victorops.default.state_message" . }}')
			.openapi({ description: "Contains long explanation of the alerted problem." }),

		// The monitoring tool the state message is from.
		monitoring_tool: z
			.string()
			.default('{{ template "victorops.default.monitoring_tool" . }}')
			.openapi({ description: "The monitoring tool the state message is from." }),

		http_config: HTTPConfigSpec.optional(),
	})
	.strict()
	.refine(...enforceMutuallyExclusive("api_key", "api_key_file"))
	.openapi({ description: "Configuration options for sending notifications to VictorOps" });

export const WebhookConfigSpec = z
	.object({
		// Whether to notify about resolved alerts.
		send_resolved: z.boolean().default(true).openapi({ description: "whether to notify about resolved alerts" }),

		// The endpoint to send HTTP POST requests to.
		// url and url_file are mutually exclusive.
		url: z
			.string()
			.optional()
			.openapi({ description: "the endpoint to send HTTP POST requests to. Mutually exclusive with url_file" }),
		url_file: z.string().optional().openapi({
			description: "the endpoint to send HTTP POST requests to, as read from a file. Mutually exclusive with url_file",
		}),

		http_config: HTTPConfigSpec.optional(),

		// The maximum number of alerts to include in a single webhook message. Alerts
		// above this threshold are truncated. When leaving this at its default value of 0, all alerts are included.
		max_alerts: z.number().int().default(0).openapi({
			description:
				"The maximum number of alerts to include in a single webhook message. Alerts  above this threshold are truncated. When leaving this at its default value of 0, all alerts are included.",
		}),
	})
	.strict()
	.refine(...enforceMutuallyExclusive("url", "url_file", true))
	.openapi({ description: "Configuration options for sending notifications to a webhook" });

export type WebhookConfig = z.infer<typeof WebhookConfigSpec>;

export const WeChatConfigSpec = z
	.object({
		// Whether to notify about resolved alerts.
		send_resolved: z.boolean().default(false).openapi({ description: "whether to notify about resolved alerts" }),

		// The API key to use when talking to the WeChat API.
		api_secret: z.string().optional().openapi({
			description: "The API key to use when talking to the WeChat API.",
		}),

		// The WeChat API URL.
		api_url: z.string().optional().openapi({
			description: "The WeChat API URL.",
		}),

		// The corp id for authentication.
		corp_id: z.string().optional().openapi({
			description: "The corp id for authentication.",
		}),

		// API request data as defined by the WeChat API.
		message: z.string().default('{{ template "wechat.default.message" . }}').openapi({
			description: "API request data as defined by the WeChat API.",
		}),

		// Type of the message type, supported values are `text` and `markdown`.
		message_type: z.enum(["text", "markdown"]).default("text").openapi({
			description: "Type of the message type, supported values are `text` and `markdown`.",
		}),

		agent_id: z.string().default('{{ template "wechat.default.agent_id" . }}').openapi({
			description: "the ID of the agent to send messages as",
		}),
		to_user: z.string().default('{{ template "wechat.default.to_user" . }}').openapi({
			description: "the ID of the user to send messages to",
		}),
		to_party: z.string().default('{{ template "wechat.default.to_party" . }}').openapi({
			description: "the ID of the party so send messages to",
		}),
		to_tag: z.string().default('{{ template "wechat.default.to_tag" . }}').openapi({
			description: "",
		}),
	})
	.strict()
	.openapi({
		description: "Configuration options for sending notifications to WeChat",
	});

export const WebexConfigSpec = z
	.object({
		// Whether to notify about resolved alerts.
		send_resolved: z.boolean().default(false).openapi({ description: "whether to notify about resolved alerts" }),

		// The Webex Teams API URL i.e. https://webexapis.com/v1/messages
		// If not specified, default API URL will be used.
		api_url: z.string().optional().openapi({
			description: "The Webex Teams API URL e.g. https://webexapis.com/v1/messages",
		}),

		// ID of the Webex Teams room where to send the messages.
		room_id: z.string().openapi({
			description: "ID of the Webex Teams room where to send the messages.",
		}),

		// Message template.
		message: z.string().default('{{ template "webex.default.message" .}}').openapi({
			description: "Message template.",
		}),

		http_config: HTTPConfigSpec.optional(),
	})
	.strict()
	.openapi({
		description: "Configuration options for sending notifications to WebEx",
	});

export const ReceiverSpec = z
	.object({
		name: z.string().openapi({ description: "the name of the receiver" }),
		discord_configs: z.array(DiscordConfigSpec).optional(),
		email_configs: z.array(EmailConfigSpec).optional(),
		msteams_configs: z.array(MSTeamsConfigSpec).optional(),
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
	.strict()
	.openapi({
		description: "Configuration options for receivers to send notifications to",
	});

export type Receiver = z.infer<typeof ReceiverSpec>;

export const InhibitRuleSpec = z
	.object({
		// DEPRECATED: Use target_matchers below.
		// Matchers that have to be fulfilled in the alerts to be muted.
		target_match: z.record(LabelNameSpec, z.string()).optional().openapi({
			description: "DEPRECATED: Use target_matchers.  Matchers that have to be fulfilled in the alerts to be muted.",
			deprecated: true,
		}),

		// DEPRECATED: Use target_matchers below.
		target_match_re: z.record(LabelNameSpec, z.string()).optional().openapi({
			description:
				"DEPRECATED: Use target_matchers.  Matchers that have to be fulfilled in the alerts to be muted, with values interpreted as a Regex",
			deprecated: true,
		}),

		// A list of matchers that have to be fulfilled by the target alerts to be muted.
		target_matchers: z.array(StringMatcherSpec).optional().openapi({
			description: "A list of matchers that have to be fulfilled by the target alerts to be muted.",
		}),

		// DEPRECATED: Use source_matchers below.
		// Matchers for which one or more alerts have to exist for the inhibition to take effect.
		source_match: z.record(LabelNameSpec, z.string()).optional().openapi({
			description:
				"DEPRECATED: Use source_matchers. Matchers for which one or more alerts have to exist for the inhibition to take effect.",
			deprecated: true,
		}),

		// DEPRECATED: Use source_matchers below.
		source_match_re: z.record(LabelNameSpec, z.string()).optional().openapi({
			description:
				"DEPRECATED: Use source_matchers. Matchers for which one or more alerts have to exist for the inhibition to take effect, with values interpreted as a Regex",
			deprecated: true,
		}),

		// A list of matchers for which one or more alerts have to exist for the inhibition to take effect.
		source_matchers: z.array(StringMatcherSpec).optional().openapi({
			description: "A list of matchers for which one or more alerts have to exist for the inhibition to take effect.",
		}),

		// Labels that must have an equal value in the source and target alert for the inhibition to take effect.
		equal: z.array(LabelNameSpec).default([]).openapi({
			description:
				"Labels that must have an equal value in the source and target alert for the inhibition to take effect.",
		}),
	})
	.strict()
	.openapi({ description: "Configuration options for inhibition rules" });

export type InhibitRule = z.infer<typeof InhibitRuleSpec>;

export const TimeSpec = z
	.string()
	.transform((val) => {
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
	})
	.openapi({ description: "A time, in the format of HH:MM", example: "13:05" });

export const WeekdayRangeSpec = z
	.string()
	.transform((a) => {
		const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

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
	})
	.openapi({
		description: "A range of days, in the format `day`, or `from:to`",
		examples: ["monday", "monday:thursday"],
	});

export const DaysOfMonthRange = z
	.string()
	.transform((a) => {
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
	})
	.openapi({
		description: "A range of days, in the format `day`, or `from:to`",
		examples: ["1", "12:30"],
	});

export const MonthRange = z
	.string()
	.transform((a) => {
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
		if (startIndex > months.length || startIndex <= 0 || Number.isNaN(startIndex)) {
			throw `month_range expects a month or a number(1-12), not ${parts[0]}`;
		}

		let endIndex = months.indexOf(parts[1]);
		endIndex = endIndex !== -1 ? endIndex : parseInt(parts[1], 10);
		if (endIndex > months.length || endIndex <= 0 || Number.isNaN(endIndex)) {
			throw `month_range expects a month or a number(1-12), not ${parts[1]}`;
		}

		return { type: "range", start: startIndex, end: endIndex };
	})
	.openapi({
		description: "A range of months, in the format `month`, or `from:to`",
		examples: ["january", "march:november"],
	});

export const YearRange = z
	.string()
	.transform((a) => {
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
	})
	.openapi({
		description: "A range of years, in the format `year`, or `from:to`",
		examples: ["2019", "2020:2024"],
	});

export const TimeRangeSpec = z
	.object({
		start_time: TimeSpec,
		end_time: TimeSpec,
	})
	.strict()
	.openapi({ description: "a range of times" });

export const TimeIntervalSpec = z
	.object({
		name: z.string().openapi({ description: "the name of the time interval" }),
		time_intervals: z.array(
			z.object({
				times: z.array(TimeRangeSpec).optional(),
				weekdays: z.array(WeekdayRangeSpec).optional(),
				days_of_month: z.array(DaysOfMonthRange).optional(),
				months: z.array(MonthRange).optional(),
				years: z.array(YearRange).optional(),
				location: z.string().default("UTC").openapi({ description: "the timezone to interpret times in" }), // TODO: Validate this.
			})
		),
	})
	.strict()
	.openapi({ description: "a time interval that can be used in muting alerts" });

export type TimeInterval = z.infer<typeof TimeIntervalSpec>;

// Walks the given routing tree, running `process` for every encountered node.
export const walkTree = (tree: RouteSpec, process: (node: RouteSpec, parent?: RouteSpec) => void) => {
	const to_process: [RouteSpec, RouteSpec | undefined][] = [[tree, undefined]];
	while (to_process.length > 0) {
		const [node, parent] = to_process.pop()!;
		process(node, parent);
		if (node.routes) {
			to_process.push(...node.routes.map((n): [RouteSpec, RouteSpec | undefined] => [n, node]));
		}
	}
};

export const GlobalConfigSpec = z
	.object({
		// The default SMTP `from` header field.
		smtp_from: z.string().optional().openapi({ description: "The default SMTP `from` header field." }),

		// The default SMTP smarthost used for sending emails, including port number.
		// Example: smtp.example.org:587
		smtp_smarthost: z.string().optional().openapi({
			description: "The default SMTP smarthost used for sending emails, including port number.",
			example: "smtp.example.org:587",
		}),

		// The default hostname to identify to the SMTP server.
		// default: localhost
		smtp_hello: z.string().default("localhost").openapi({
			description: "The default hostname to identify to the SMTP server.",
		}),

		// SMTP Auth using CRAM-MD5, LOGIN and PLAIN. If empty, Alertmanager doesn't authenticate to the SMTP server.
		smtp_auth_username: z.string().optional().openapi({
			description:
				"SMTP Auth using CRAM-MD5, LOGIN and PLAIN. If empty, Alertmanager doesn't authenticate to the SMTP server.",
		}),

		// SMTP Auth using LOGIN and PLAIN.
		smtp_auth_password: z.string().optional().openapi({
			description:
				"The password to use to authenticate against the SMTP server, using PLAIN. Mutually exclusive with smtp_auth_password_file",
		}),
		smtp_auth_password_file: z.string().optional().openapi({
			description:
				"The password to use to authenticate against the SMTP server, loaded from a file, using PLAIN. Mutually exclusive with smtp_auth_password_file",
		}),

		// SMTP Auth using PLAIN.
		smtp_auth_identity: z.string().optional().openapi({
			description: "SMTP Auth using PLAIN.",
		}),

		// SMTP Auth using CRAM-MD5.
		smtp_auth_secret: z.string().optional().openapi({
			description: "SMTP Auth using CRAM-MD5.",
		}),

		// The default SMTP TLS requirement.
		smtp_require_tls: z.boolean().default(true).openapi({
			description: "The default SMTP TLS requirement.",
		}),

		slack_api_url: z.string().optional().openapi({
			description: "The default URL to use when sending messages to slack",
		}),
		slack_api_url_file: z.string().optional().openapi({
			description: "The default URL to use when sending messages to slack, loaded from a file",
		}),
		victorops_api_key: z.string().optional().openapi({
			description: "The default api key to use when sending messages to victorops",
		}),
		victorops_api_key_file: z.string().optional().openapi({
			description: "The default api key to use when sending messages to victorops, loaded from a file",
		}),
		victorops_api_url: z.string().default("https://alert.victorops.com/integrations/generic/20131114/alert/").openapi({
			description: "The default URL to use when sending messages to VictorOps",
		}),
		pagerduty_url: z.string().default("https://events.pagerduty.com/v2/enqueue").openapi({
			description: "The default URL to use when sending messages to Pagerduty",
		}),
		opsgenie_api_key: z.string().optional().openapi({
			description: "The default API Key to use when sending messages to OpsGenie",
		}),
		opsgenie_api_key_file: z.string().optional().openapi({
			description: "The default API Key to use when sending messages to OpsGenie, loaded from a file",
		}),
		opsgenie_api_url: z.string().default("https://api.opsgenie.com/").openapi({
			description: "The default URL to use when sending messages to OpsGenie",
		}),
		wechat_api_url: z.string().default("https://qyapi.weixin.qq.com/cgi-bin/").openapi({
			description: "The default URL to use when sending messages to WeChat",
		}),
		wechat_api_secret: z.string().optional().openapi({
			description: "The default API Key to use when sending messages to WeChat",
		}),
		wechat_api_corp_id: z.string().optional().openapi({
			description: "The default Corp ID to use when sending messages to WeChat",
		}),
		telegram_api_url: z.string().default("https://api.telegram.org").openapi({
			description: "The default URL to use when sending messages to Telegram",
		}),
		webex_api_url: z.string().default("https://webexapis.com/v1/messages").openapi({
			description: "The default URL to use when sending messages to WebEx",
		}),
		http_config: HTTPConfigSpec.default(HTTPConfigSpec.parse({})),

		// resolve_timeout is the default value used by alertmanager if the alert does
		// not include EndsAt, after this time passes it can declare the alert as resolved if it has not been updated.
		// This has no impact on alerts from Prometheus, as they always include EndsAt.
		resolve_timeout: z.string().default("5s").openapi({
			description:
				"resolve_timeout is the default value used by alertmanager if the alert does not include EndsAt, after this time passes it can declare the alert as resolved if it has not been updated.",
		}),
	})
	.strict()
	.refine(...enforceMutuallyExclusive("smtp_auth_password", "smtp_auth_password_file"))
	.refine(...enforceMutuallyExclusive("slack_api_url", "slack_api_url_file"))
	.refine(...enforceMutuallyExclusive("victorops_api_key", "victorops_api_key_file"))
	.refine(...enforceMutuallyExclusive("opsgenie_api_key", "opsgenie_api_key_file"))
	.openapi({ description: "the global configs, used as defaults in all receivers" });

export const TemplatePathSpec = z
	.string()
	.refine((p) => {
		const parts = p.split(new RegExp(`[/\\\\]`));
		for (let i = 0; i < parts.length; i++) {
			if (parts[i].includes("*") && i != parts.length - 1) {
				return false;
			}
		}

		return true;
	}, "only last component of the template path can contain a wildcard")
	.openapi({ description: "a path to load templates from, optionally with a glob" });

export const AlertmanagerConfigSpec = z
	.object({
		global: GlobalConfigSpec.default(GlobalConfigSpec.parse({})),
		// Files from which custom notification template definitions are read.
		// The last component may use a wildcard matcher, e.g. 'templates/*.tmpl'.
		templates: z.array(TemplatePathSpec).default([]),

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
	.refine(...enforceMutuallyExclusive("smtp_auth_password", "smtp_auth_password_file"))
	.refine(...enforceMutuallyExclusive("slack_api_url", "slack_api_url_file"))
	.refine(...enforceMutuallyExclusive("victorops_api_key", "victorops_api_key_file"))
	.refine(...enforceMutuallyExclusive("opsgenie_api_key", "opsgenie_api_key_file"))
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
		conf.route ? walkTree(conf.route, (r) => (r.receiver ? neededReceiverNames.push(r.receiver) : {})) : {};

		const missingReceivers = neededReceiverNames.filter((n) => !existingReceiverNames.includes(n));

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

		const time_interval_names: Record<string, z.infer<typeof TimeIntervalSpec>> = {};
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
	})
	.openapi({ description: "An Alertmanager compatible config file" });

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
