import { ArrowPathIcon } from "@heroicons/react/16/solid";
import { useMemo, useState } from "preact/hooks";
import { AlertCard } from "../../components/AlertCard";
import { MatcherCard } from "../../components/MatcherCard";
import { getAlerts, GetAlertsError, GetAlertsResponse, postSilence } from "../../pkg/api/client";
import { Matcher } from "../../pkg/types/api";
import { DurationSpec } from "../../pkg/types/duration";
import { DataPull, matcherToString, useQuery } from "../../pkg/types/utils";
import { formatDate } from "./utils";

export interface PreviewProps {
	duration: string;
	matchers: Matcher[];
	comment: string;
}

const getHumanNumber = (n: number, one_suffix: string, multiple: string) => {
	if (n === 0) {
		return "None";
	} else if (n === 1) {
		return `1 ${one_suffix}`;
	} else {
		return `${n} ${multiple}`;
	}
};

const getAffectAlertTitle = (affectedAlerts: DataPull<GetAlertsResponse, GetAlertsError>) => {
	switch (affectedAlerts.state) {
		case "error":
			return <>Error Fetching Affected Alerts</>;
		case "pending":
			return (
				<span>
					<ArrowPathIcon class="animate-spin inline size-5" />
					Affected Alerts
				</span>
			);
		case "success":
			if (affectedAlerts.result.length === 0) {
				return <>No Affected Alerts</>;
			} else {
				return <>{getHumanNumber(affectedAlerts.result.length, "Affected Alert", "Affected Alerts")}</>;
			}
	}
};

export const PreviewSilence = ({ duration, matchers, comment }: PreviewProps) => {
	const startTime = useMemo(() => {
		return new Date();
	}, []);

	const endTime = useMemo(() => {
		const realDuration = DurationSpec.parse(duration);
		return new Date(startTime.getTime() + realDuration);
	}, [duration, startTime]);

	const affectedAlerts = useQuery(async () => {
		const filter = matchers.map((m) => matcherToString(m));
		return getAlerts({ query: { filter } });
	}, [matchers]);

	const [createStatus, setCreateStatus] = useState<"not" | "pending" | "error" | "created">("not");

	const onCreate = async () => {
		if (createStatus === "pending" || createStatus === "created") {
			return;
		}

		try {
			setCreateStatus("pending");
			const { data: id } = await postSilence({
				body: {
					matchers,
					startsAt: startTime.toISOString(),
					endsAt: endTime.toISOString(),
				},
			});

			setCreateStatus("created");
			window.location.href = "/silence/" + id;
		} catch (e) {
			setCreateStatus("error");
			// TODO: Show a toast here.
		}
	};

	// TODO: Paginate the affected alerts here.
	return (
		<>
			<span>
				<h2 class="text-xl inline font-bold">Starts:</h2> {formatDate(startTime)}
			</span>
			<span>
				<h2 class="text-xl inline font-bold">Ends:</h2> {formatDate(endTime)}
			</span>
			<span>
				<h2 class="text-xl font-bold">Matchers:</h2>

				<div class="flex flex-row flex-wrap flex-shrink flex-grow-0">
					{matchers.map((m) => (
						<MatcherCard matcher={m} />
					))}
				</div>
			</span>
			<span>
				<h2 class="text-xl inline pt-4 font-bold">Comment:</h2> {comment}
			</span>

			<span class="flex flex-col">
				<h2 class="text-xl inline pt-4 font-bold">{getAffectAlertTitle(affectedAlerts)}</h2>
				{affectedAlerts.state === "success" && affectedAlerts.result.map((a) => <AlertCard class="p-3" alert={a} />)}
			</span>
			<span>
				<button class="p-2 bg-green-600 rounded my-3" onClick={onCreate}>
					Create!
				</button>
			</span>
		</>
	);
};
