import { ArrowPathIcon } from "@heroicons/react/16/solid";
import { useMemo, useState } from "preact/hooks";
import { AlertCard } from "../../components/AlertCard";
import { MatcherCard } from "../../components/MatcherCard";
import Paginator from "../../components/Paginator";
import { getAlerts, GetAlertsResponse, postSilence } from "../../pkg/api/client";
import { Matcher } from "../../pkg/types/api";
import { DurationSpec } from "../../pkg/types/duration";
import { DataPull, matcherToString, useQuery } from "../../pkg/types/utils";
import { getUploadIcon, UploadStatus } from "../Onboarding/upload";
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

const getAffectAlertTitle = (affectedAlerts: DataPull<GetAlertsResponse, unknown>) => {
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
				return (
					<>
						{getHumanNumber(parseInt(affectedAlerts.headers.get("X-Total-Count")), "Affected Alert", "Affected Alerts")}
					</>
				);
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

	const [currentPage, setCurrentPage] = useState(1);
	const affectedAlerts = useQuery(() => {
		return getAlerts({
			query: {
				page: currentPage,
				limit: 10,
				sort: ["startsAt:desc"],
				filter: matchers.map((m) => matcherToString(m)),
			},
		});
	}, [matchers, currentPage]);

	const numPages = useMemo(() => {
		if (affectedAlerts.state !== "success") {
			return 1;
		}

		const numSilences = Math.max(parseInt(affectedAlerts.headers.get("X-Total-Count")), 1);

		return Math.ceil(numSilences / 10);
	}, [affectedAlerts]);

	const [createStatus, setCreateStatus] = useState<UploadStatus>(UploadStatus.NotUploaded);

	const onCreate = async () => {
		if (createStatus === UploadStatus.Uploading || createStatus === UploadStatus.Uploaded) {
			return;
		}

		try {
			setCreateStatus(UploadStatus.Uploading);
			const resp = await postSilence({
				body: {
					matchers,
					startsAt: startTime.toISOString(),
					endsAt: endTime.toISOString(),
					comment,
				},
			});

			if (resp.error) {
				console.log(resp.error);
				return;
			}

			if (typeof resp.data !== "undefined") {
				setCreateStatus(UploadStatus.Uploaded);
				window.location.href = "/silences/" + resp.data;
			}
		} catch {
			setCreateStatus(UploadStatus.Error);
			// TODO: Show a toast here.
		}
	};

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
				<Paginator
					totalPages={numPages}
					currentPage={currentPage}
					setCurrentPage={setCurrentPage}
					maxPagesInRange={5}
					class="w-full"
				>
					{affectedAlerts.state === "success" && affectedAlerts.result.map((a) => <AlertCard class="p-3" alert={a} />)}
				</Paginator>
			</span>
			<span>
				<button class="p-2 bg-green-600 rounded my-3" onClick={onCreate}>
					{getUploadIcon(createStatus)}
					Create!
				</button>
			</span>
		</>
	);
};
