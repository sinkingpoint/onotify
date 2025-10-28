import { SpanStatusCode, trace } from "@opentelemetry/api";
import * as jose from "jose";
import { Bindings } from "../../types/internal";

const API_KEY_PREFIX = "notify-";

interface APIKeyError {
	result: "missing" | "malformed" | "expired" | "invalid" | "missing scope";
	text?: string;
}

export interface UserData {
	id: string;
	name: string;
}

// Keys with a wildcard scope are allowed to do anything.
const WILDCARD_SCOPE = "*";

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

type APIKeyData = jose.JWTPayload & {
	scopes: string[];
};

interface APIKey {
	result: "ok";
	accountID: string;
	userID: string;
	scopes: string[];
}

type APIKeyResult = APIKey | APIKeyError;

// Attempts to validate the given auth header, ensuring that the attached API key:
// 1. exists
// 2. hasn't expired
// 3. has all of the required scopes
export const checkAPIKey = async (
	env: Bindings,
	auth_header: string | undefined,
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

	if (key.startsWith(API_KEY_PREFIX)) {
		return validateAPIKey(env, key, ...requiredScopes);
	} else {
		return validateUserToken(env, key, ...requiredScopes);
	}
};

const validateUserToken = async (env: Bindings, key: string, ...requiredScopes: string[]): Promise<APIKeyResult> => {
	const jwkKey = JSON.parse(env.AUTH_JWK);
	const publicKey = await jose.importJWK(jwkKey["keys"][0]);

	try {
		const { payload } = await jose.jwtVerify<APIKeyData>(key, publicKey, {});
		if (payload.nbf && payload.nbf !== 0 && payload.nbf > Date.now() / 1000) {
			return {
				result: "expired",
				text: "api key not valid yet",
			};
		}

		if (payload.exp && payload.exp !== 0 && payload.exp < Date.now() / 1000) {
			return {
				result: "expired",
				text: "api key expired",
			};
		}

		const scopes = validateScopes(payload.scopes ?? [], ...requiredScopes);
		if (!scopes.result) {
			return {
				result: "missing scope",
				text: `missing scopes: ${scopes.missingScopes.join(", ")}`,
			};
		}

		return {
			result: "ok",
			accountID: payload.account_id as string,
			userID: payload.user_id as string,
			scopes: payload.scopes ?? [],
		};
	} catch (e: any) {
		trace.getActiveSpan()?.setStatus({ code: SpanStatusCode.ERROR, message: e.toString() });
		return {
			result: "invalid",
			text: "invalid JWT",
		};
	}
};

const validateAPIKey = async (env: Bindings, key: string, ...requiredScopes: string[]): Promise<APIKeyResult> => {
	type apiKeyResult = {
		account_id: string;
		user_id: string;
		expires: number;
		scopes: string;
	};

	const keyWithoutPrefix = key.substring(API_KEY_PREFIX.length);
	const keyHash = await hashPassword(keyWithoutPrefix, new Uint8Array());

	console.log("Validating API key with hash:", keyHash);

	const data: D1Result<apiKeyResult> = await env.DB.prepare(
		`SELECT account_id, user_id, expires, scopes FROM api_keys WHERE key=?`,
	)
		.bind(keyHash)
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
			}),
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
	const validation = validateScopes(scopes, ...requiredScopes);
	if (!validation.result) {
		return {
			result: "missing scope",
			text: `missing scopes: ${validation.missingScopes.join(", ")}`,
		};
	}

	return {
		result: "ok",
		accountID: result["account_id"] as string,
		userID: result["user_id"] as string,
		scopes,
	};
};

const validateScopes = (
	scopes: string[],
	...requiredScopes: string[]
): { result: false; missingScopes: string[] } | { result: true } => {
	if (!scopes.includes(WILDCARD_SCOPE)) {
		const missingScopes = requiredScopes.filter((scope) => !scopes.includes(scope));
		if (missingScopes.length > 0) {
			return {
				result: false,
				missingScopes,
			};
		}
	}

	return {
		result: true,
	};
};

interface GetUserInfoError {
	result: "not found" | "unauthorized" | "internal error";
}

interface GetUserInfoResult {
	result: "ok";
	user: UserData;
}

export type GetUserInfo = GetUserInfoResult | GetUserInfoError;

export const getUserInfo = async (env: Bindings, authResult: APIKeyResult, userID: string): Promise<GetUserInfo> => {
	if (authResult.result !== "ok") {
		return {
			result: "unauthorized",
		};
	}

	// The user is allowed to fetch the requested user if they are the same user, or
	// if the user currently is in an account that the requested user is also in.

	const accountMembership: D1Result<any> = await env.DB.prepare(
		`SELECT user_id, account_id FROM account_membership WHERE user_id=? AND account_id=?`,
	)
		.bind(userID, authResult.accountID)
		.run();

	if (accountMembership.results.length === 0) {
		console.log("User not found in account membership");
		return {
			result: "not found",
		};
	}

	const user: UserData | null = await env.DB.prepare(`SELECT id, name FROM user WHERE id=?`).bind(userID).first();
	if (!user) {
		console.log("User not found");
		return {
			result: "not found",
		};
	}

	return {
		result: "ok",
		user,
	};
};

export async function hashPassword(password: string, providedSalt?: Uint8Array): Promise<string> {
	const encoder = new TextEncoder();
	// Use provided salt if available, otherwise generate a new one
	const salt = providedSalt ?? crypto.getRandomValues(new Uint8Array(16));
	const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), { name: "PBKDF2" }, false, [
		"deriveBits",
		"deriveKey",
	]);
	const key = await crypto.subtle.deriveKey(
		{
			name: "PBKDF2",
			salt: salt,
			iterations: 100000,
			hash: "SHA-256",
		},
		keyMaterial,
		{ name: "AES-GCM", length: 256 },
		true,
		["encrypt", "decrypt"],
	);
	const exportedKey = (await crypto.subtle.exportKey("raw", key)) as ArrayBuffer;
	const hashBuffer = new Uint8Array(exportedKey);
	const hashArray = Array.from(hashBuffer);
	const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
	const saltHex = Array.from(salt)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
	if (saltHex.length === 0) {
		return hashHex;
	}
	return `${saltHex}:${hashHex}`;
}

export async function verifyPassword(storedHash: string, passwordAttempt: string): Promise<boolean> {
	const [saltHex, originalHash] = storedHash.split(":");
	const matchResult = saltHex.match(/.{1,2}/g);
	if (!matchResult) {
		throw new Error("Invalid salt format");
	}
	const salt = new Uint8Array(matchResult.map((byte) => parseInt(byte, 16)));
	const attemptHashWithSalt = await hashPassword(passwordAttempt, salt);
	const [, attemptHash] = attemptHashWithSalt.split(":");
	return attemptHash === originalHash;
}
