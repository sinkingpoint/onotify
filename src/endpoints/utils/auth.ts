import { HonoRequest } from "hono";
import * as jose from "jose";
import { Bindings } from "../../types/internal";
import { getCookie } from "./cookie";

const API_KEY_PREFIX = "notify-";

interface APIKeyError {
	result: "missing" | "malformed" | "expired" | "invalid" | "missing scope";
	text?: string;
}

export interface UserData {
	id: string;
	name: string;
	email: string;
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
	scopes?: string[];
	email?: string;
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
	req: HonoRequest,
	...requiredScopes: string[]
): Promise<APIKeyResult> => {
	const authHeader = req.header("Authorization");
	const cfAccessCookie = getCookie(req, "CF_Authorization");
	if (!authHeader && !cfAccessCookie) {
		return {
			result: "missing",
		};
	}

	if (authHeader) {
		const [bearer, key] = authHeader.split(" ");
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
	}

	return validateUserToken(env, cfAccessCookie!, ...requiredScopes);
};

const fetchPublicKeys = async (env: Bindings): Promise<(jose.CryptoKey | Uint8Array<ArrayBufferLike>)[]> => {
	type jwkKey = {
		keys: jose.JWK[];
	};
	if (env.AUTH_JWK) {
		const jwkKey: jwkKey = JSON.parse(env.AUTH_JWK);
		return Promise.all(jwkKey["keys"].map((k: jose.JWK) => jose.importJWK(k)));
	} else if (env.AUTH_JWK_URL) {
		const response = await fetch(env.AUTH_JWK_URL);
		if (!response.ok) {
			throw new Error("Failed to fetch JWKs");
		}
		const jwkKey: jwkKey = await response.json();
		return Promise.all(jwkKey["keys"].map((k: jose.JWK) => jose.importJWK(k)));
	} else {
		throw new Error("No JWK or JWK URL configured");
	}
};

const validateUserToken = async (env: Bindings, key: string, ...requiredScopes: string[]): Promise<APIKeyResult> => {
	const publicKeys = await fetchPublicKeys(env);
	let payload: (jose.JWTPayload & APIKeyData) | undefined = undefined;

	for (const publicKey of publicKeys) {
		try {
			const decoded = await jose.jwtVerify<APIKeyData>(key, publicKey, {});
			payload = decoded.payload;
		} catch (e: any) {
			// Ignore errors, we just try the next key
		}
	}

	if (!payload) {
		return {
			result: "invalid",
			text: "invalid jwt",
		};
	}

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

	if (!payload.scopes && payload.email) {
		// This is a CF Access token, look up the user's scopes from the database.
		const user: { user_id: string } | null = await env.DB.prepare(`SELECT id AS user_id FROM user WHERE email=?`)
			.bind(payload.email)
			.first();

		if (user) {
			const membership: { account_id: string; user_id: string; scopes: string } | null = await env.DB.prepare(
				`SELECT account_id,user_id,scopes FROM account_membership WHERE user_id=?`,
			)
				.bind(user.user_id)
				.first();

			if (membership) {
				payload.scopes = membership.scopes.split(",");
				payload.user_id = membership.user_id;
				payload.account_id = membership.account_id;
			}
		}
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
	result: "not found";
}

interface GetUserInfoResult {
	result: "ok";
	user: UserData & {
		scopes: string[];
	};
}

export type GetUserInfo = GetUserInfoResult | GetUserInfoError;

export const getUserInfo = async (env: Bindings, userID: string, accountID: string): Promise<GetUserInfo> => {
	// The user is allowed to fetch the requested user if they are the same user, or
	// if the user currently is in an account that the requested user is also in.
	const accountMembership: D1Result<{ user_id: string; account_id: string; scopes: string[] }> = await env.DB.prepare(
		`SELECT user_id, account_id, scopes FROM account_membership WHERE user_id=? AND account_id=?`,
	)
		.bind(userID, accountID)
		.run();

	if (accountMembership.results.length === 0) {
		return {
			result: "not found",
		};
	}

	const user: UserData | null = await env.DB.prepare(`SELECT id, name, email FROM user WHERE id=?`)
		.bind(userID)
		.first();
	if (!user) {
		return {
			result: "not found",
		};
	}

	return {
		result: "ok",
		user: {
			scopes: accountMembership.results[0]["scopes"] as string[],
			...user,
		},
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
