import HeatMap from "@uiw/react-heat-map";
import { useMemo, useRef, useState } from "preact/hooks";
import { Tooltip } from "react-tooltip";
import InfoBox from "../../components/InfoBox";
import Paginator from "../../components/Paginator";
import { SkeletonLoader } from "../../components/Skeleton";
import { getAlertHistory, GetAlertHistoryResponse } from "../../pkg/api/client";
import { useQuery } from "../../pkg/types/utils";

type HistoryPaneProps = {
	fingerprint: string;
};

const HistoryCard = (event: { event: GetAlertHistoryResponse["entries"][number] }) => {
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
	const heatmapHoverRef = useRef();
	const [currentPage, setCurrentPage] = useState(0);
	const historyEventsPull = useQuery(() => {
		return getAlertHistory({
			query: {
				page: currentPage,
				pageSize: 10,
			},
			path: { fingerprint },
		});
	}, [currentPage]);

	const historyStats =
		historyEventsPull.state === "success"
			? Object.keys(historyEventsPull.result.stats).map((day) => {
					return {
						date: day.replace("-", "/"),
						count: historyEventsPull.result.stats[day],
					};
				})
			: [];

	const numPages = useMemo(() => {
		if (historyEventsPull.state !== "success") {
			return 1;
		}

		const numSilences = Math.max(parseInt(historyEventsPull.headers.get("X-Total-Count")), 1);

		return Math.ceil(numSilences / 10);
	}, [historyEventsPull]);

	const getStartDate = () => {
		const date = new Date();
		date.setDate(1);
		date.setMonth(date.getMonth() - 12);
		return date;
	};

	return (
		<div>
			<SkeletonLoader layout="paragraph" pull={historyEventsPull}>
				<Tooltip place="top" anchorSelect=".date-entry">{`foo`}</Tooltip>
				{historyEventsPull.state === "success" && (
					<HeatMap
						value={historyStats}
						startDate={getStartDate()}
						endDate={new Date()}
						rectProps={{
							rx: 1,
						}}
						style={{
							"--rhm-text-color": "#d3d3d3",
							"font-size": "12px",
						}}
						weekLabels={["", "Mon", "", "Wed", "", "Fri", ""]}
						width="100%"
						panelColors={["#d3d3d3", "#ffa0a0", "#ff7070", "#df7373", "#d76b6b", "#a54949"]}
						rectRender={(props, data) => {
							let tooltip: string;
							if (!data.count) {
								tooltip = `No events`;
							} else if (data.count === 1) {
								tooltip = `1 event`;
							} else {
								tooltip = `${data.count} events`;
							}
							return <rect class="date-entry" data-tooltip-content={`${tooltip} on ${data.date}`} {...props} />;
						}}
					/>
				)}
			</SkeletonLoader>
			<Paginator currentPage={currentPage} setCurrentPage={setCurrentPage} totalPages={numPages}>
				<SkeletonLoader layout="paragraph" pull={historyEventsPull}>
					{historyEventsPull.state === "success" && historyEventsPull.result.entries.length === 0 && (
						<div class="p-4 italic text-center text-gray-500">No history events found for this alert.</div>
					)}
					{historyEventsPull.state === "error" && (
						<InfoBox style="error" text="Failed to load history events" class="w-full" />
					)}
					<>
						{historyEventsPull.state === "success" &&
							historyEventsPull.result.entries.map((event) => <HistoryCard event={event} />)}
					</>
				</SkeletonLoader>
			</Paginator>
		</div>
	);
};
