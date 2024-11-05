import { Bindings } from "../types/internal";

const API_KEY_PREFIX = "notify-";

interface APIKeyError {
  result: "missing" | "malformed" | "expired" | "invalid" | "missing scope";
  text?: string;
}

export const toErrorString = (e: APIKeyError) => {
  const ext = e.text ? `: ${e.text}` : "";
  switch (e.result) {
    case "missing":
      return `Missing Authorization Header${ext}`;
    case "malformed":
      return `Malformed API Key:${ext}`;
    case "expired":
      return `Expired API Key:${ext}`;
    case "invalid":
      return `Invalid API Key:${ext}`;
    case "missing scope":
      return `API Key is not allowed to do that: ${ext}`;
  }
};

interface APIKey {
  result: "ok";
  account_id: string;
  user_id: string;
  scopes: string[];
}

type APIKeyResult = APIKey | APIKeyError;

// Attempts to validate the given auth header, ensuring that the attached API key:
// 1. exists
// 2. hasn't expired
// 3. has all of the required scopes
export const checkAPIKey = async (
  env: Bindings,
  auth_header: string,
  ...requiredScopes: string[]
): Promise<APIKeyResult> => {
  if (!auth_header) {
    return {
      result: "missing",
    };
  }

  const [bearer, key] = auth_header.split(" ");
  if (bearer !== "Bearer") {
    return {
      result: "malformed",
      text: "missing Bearer prefix",
    };
  }

  if (!key.startsWith(API_KEY_PREFIX)) {
    return {
      result: "malformed",
      text: `missing ${API_KEY_PREFIX} prefix`,
    };
  }

  const data = await env.DB.prepare(
    `SELECT account_id, user_id, expires, scopes FROM api_keys WHERE key=?`
  )
    .bind(key)
    .run();

  if (data.results.length === 0) {
    return {
      result: "invalid",
    };
  }

  if (data.results.length > 1) {
    // This is really bad - we have two API keys that are the same.
    console.error(
      JSON.stringify({
        error: "found two api keys with the same value",
        prefix: key.substring(0, API_KEY_PREFIX.length + 5),
      })
    );
    throw `BUG: Got two api keys with the same value`;
  }

  const result = data.results[0];
  const expires: number = result["expires"] as number;
  if (expires > 0 && expires <= Date.now() / 1000) {
    return {
      result: "expired",
      text: "api key expired",
    };
  }

  const scopes: string[] = ((result["scopes"] as string) ?? "").split(",");
  for (const required of requiredScopes) {
    if (!scopes.includes(required)) {
      return {
        result: "missing scope",
        text: `missing required scope: ${required}`,
      };
    }
  }

  return {
    result: "ok",
    account_id: data["account_id"],
    user_id: data["user_id"],
    scopes: scopes,
  };
};

export const routingKVTreeKey = (account_id: string) => {
  return `onotify-${account_id}-routing-tree`;
};

export const receiversKVKey = (account_id: string) => {
  return `onotify-${account_id}-routing-tree`;
};

export const inhibitionsKVKey = (account_id): string => {
  return `onotify-${account_id}-inhibititions`;
};
