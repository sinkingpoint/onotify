import { useMemo, useState } from "preact/hooks";
import InfoBox from "../../components/InfoBox";
import Paginator from "../../components/Paginator";
import { SkeletonLoader } from "../../components/Skeleton";
import { getAlertHistory, GetAlertHistoryResponse } from "../../pkg/api/client";
import { useQuery } from "../../pkg/types/utils";

type HistoryPaneProps = {
	fingerprint: string;
};

const HistoryCard = (event: { event: GetAlertHistoryResponse["200"] }) => {
	return (
		<div class="border-b border-gray-300 dark:border-gray-600 py-2 px-4">
			<div class="text-sm text-gray-500">{new Date(event.event.timestamp).toLocaleString()}</div>
			<div class="mt-1">
				{event.event.ty === "firing" && <span class="text-[color:--error] font-semibold">Firing</span>}
				{event.event.ty === "resolved" && <span class="text-[color:--background-two] font-semibold">Resolved</span>}
				{event.event.ty === "acknowledged" && <span class="text-[color:--warning] font-semibold">Acknowledged</span>}
				{event.event.ty === "comment" && (
					<span class="">
						Comment by {event.event.userID}: {event.event.comment}
					</span>
				)}
			</div>
		</div>
	);
};

export default ({ fingerprint }: HistoryPaneProps) => {
	const [currentPage, setCurrentPage] = useState(1);
	const historyEvents = useQuery(() => {
		return getAlertHistory({
			query: {
				page: currentPage,
				pageSize: 10,
			},
			path: { fingerprint },
		});
	}, [currentPage]);

	const numPages = useMemo(() => {
		if (historyEvents.state !== "success") {
			return 1;
		}

		const numSilences = Math.max(parseInt(historyEvents.headers.get("X-Total-Count")), 1);

		return Math.ceil(numSilences / 10);
	}, [historyEvents]);

	return (
		<Paginator currentPage={currentPage} setCurrentPage={setCurrentPage} totalPages={numPages}>
			<SkeletonLoader layout="paragraph" pull={historyEvents}>
				{historyEvents.state === "success" && historyEvents.result.length === 0 && (
					<div class="p-4 italic text-center text-gray-500">No history events found for this alert.</div>
				)}
				{historyEvents.state === "error" && (
					<InfoBox style="error" text="Failed to load history events" class="w-full" />
				)}
				<>{historyEvents.state === "success" && historyEvents.result.map((event) => <HistoryCard event={event} />)}</>
			</SkeletonLoader>
		</Paginator>
	);
};
