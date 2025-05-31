import { RequestResult } from "@hey-api/client-fetch";
import { useEffect, useState } from "preact/hooks";
import { Matcher } from "./api";

export const matcherToString = (matcher: Matcher) => {
	let comparison = "";
	if (matcher.isEqual) {
		if (matcher.isRegex) {
			comparison = "=~";
		} else {
			comparison = "=";
		}
	} else {
		if (matcher.isRegex) {
			comparison = "!~";
		} else {
			comparison = "!=";
		}
	}

	return `${matcher.name}${comparison}"${matcher.value}"`;
};

type RefreshFunc = () => void;

interface DataPullSuccess<T> {
	state: "success";
	headers: Headers;
	result: T;
	refresh: RefreshFunc;
}

interface DataPullPending {
	state: "pending";
}

interface DataPullError<T> {
	state: "error";
	headers: Headers;
	error: T;
	refresh: RefreshFunc;
}

export type DataPull<TSuccess, TError> = DataPullSuccess<TSuccess> | DataPullPending | DataPullError<TError>;

export const useQuery = <TSuccess, TError>(
	puller: () => RequestResult<TSuccess | undefined, TError> | Promise<null>,
	deps: unknown[],
): DataPull<TSuccess, TError> => {
	const [pull, setPull] = useState<DataPull<TSuccess, TError>>({
		state: "pending",
	});

	useEffect(() => {
		const query = async () => {
			const result = await puller();
			if (!result) {
				// Generally this means that the pull was invalid for some reason, maybe because one of the deps
				// is not ready yet.
				return;
			}

			const refresh = async () => {
				setPull({
					state: "pending",
				});

				const result = await puller();
				if (result === null) {
					return;
				}

				if ("error" in result && result.error) {
					setPull({
						state: "error",
						headers: result.response.headers,
						error: result.error,
						refresh,
					});
				} else if (result.data) {
					setPull({
						state: "success",
						headers: result.response.headers,
						result: result.data,
						refresh,
					});
				}
			};

			if ("error" in result && result.error) {
				setPull({
					state: "error",
					headers: result.response.headers,
					error: result.error,
					refresh: refresh,
				});
			} else if (result.data) {
				setPull({
					state: "success",
					headers: result.response.headers,
					result: result.data,
					refresh: refresh,
				});
			}
		};

		query();
	}, deps);

	return pull;
};

// Set the given parameter in the URL, without reloading the page.
export const setURLParam = <T>(paramName: string, values: T | T[]) => {
	const url = new URL(window.location.toString());
	const params = new URLSearchParams(url.search);
	if (Array.isArray(values)) {
		params.delete(paramName);
		values.forEach((m) => params.append(paramName, m.toString()));
	} else {
		params.set(paramName, values.toString());
	}

	url.search = params.toString();
	history.replaceState({}, "", url.toString());
};
