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

interface DataPullSuccess<T> {
	state: "success";
	result: T;
}

interface DataPullPending {
	state: "pending";
}

interface DataPullError<T> {
	state: "error";
	error: T;
}

export type DataPull<TSuccess, TError> = DataPullSuccess<TSuccess> | DataPullPending | DataPullError<TError>;

export const useQuery = <TSuccess, TError>(
	puller: () => RequestResult<TSuccess | undefined, TError> | Promise<null>,
	deps: any[]
): DataPull<TSuccess, TError> => {
	const [pull, setPull] = useState<DataPull<TSuccess, TError>>({
		state: "pending",
	});

	useEffect(() => {
		const query = async () => {
			const result = await puller();
			if (result === null) {
				// Generally this means that the pull was invalid for some reason, maybe because one of the deps
				// is not ready yet.
				return;
			}

			if ("error" in result && result.error) {
				setPull({
					state: "error",
					error: result.error,
				});
			} else if (result.data) {
				setPull({
					state: "success",
					result: result.data,
				});
			}
		};

		query();
	}, deps);

	return pull;
};
