import HeatMap from "@uiw/react-heat-map";
import { useEffect, useMemo, useState } from "preact/hooks";
import { Tooltip } from "react-tooltip";
import InfoBox from "../../components/InfoBox";
import Paginator from "../../components/Paginator";
import { SkeletonLoader } from "../../components/Skeleton";
import { TextBox } from "../../components/TextBox";
import {
	getAlertHistory,
	GetAlertHistoryResponse,
	getUser,
	GetUserResponse,
	postAlertComment,
} from "../../pkg/api/client";
import { useQuery } from "../../pkg/types/utils";

type HistoryPaneProps = {
	fingerprint: string;
};

type HistoryCardProps = {
	event: GetAlertHistoryResponse["entries"][number];
	users: GetUserResponse[];
};

const HistoryCard = ({ event, users }: HistoryCardProps) => {
	return (
		<div class="border-b border-gray-300 dark:border-gray-600 py-2 px-4">
			<div class="text-sm text-gray-500">{new Date(event.timestamp).toLocaleString()}</div>
			<div class="mt-1">
				{event.ty === "firing" && <span class="text-[color:--error] font-semibold">Firing</span>}
				{event.ty === "resolved" && <span class="text-[color:--background-two] font-semibold">Resolved</span>}
				{event.ty === "acknowledged" && <span class="text-[color:--warning] font-semibold">Acknowledged</span>}
				{event.ty === "comment" && (
					<span class="">
						{users.find((user) => event.ty === "comment" && user.user.id === event.userID)?.user.name}: {event.comment}
					</span>
				)}
			</div>
		</div>
	);
};

export default ({ fingerprint }: HistoryPaneProps) => {
	const [currentPage, setCurrentPage] = useState(1);
	const historyEventsPull = useQuery(() => {
		return getAlertHistory({
			query: {
				page: currentPage,
				limit: 10,
				fingerprints: [fingerprint],
			},
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

	const [commentUsers, setCommentUsers] = useState<GetUserResponse[]>([]);

	useEffect(() => {
		const fetchUsers = async () => {
			if (historyEventsPull.state !== "success") {
				setCommentUsers([]);
				return;
			}

			const users = new Set<string>();
			historyEventsPull.result.entries.forEach((event) => {
				if (event.ty === "comment") {
					users.add(event.userID);
				}
			});

			const userResponses = await Promise.all(Array.from(users).map((userID) => getUser({ path: { userID } })));
			setCommentUsers(userResponses.map((res) => res.data));
		};

		fetchUsers();
	}, [historyEventsPull]);

	const addComment = (comment: string) => {
		return postAlertComment({
			path: {
				fingerprint,
			},
			body: {
				comment,
			},
		});
	};

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

			<div class="flex flex-col md:flex-row justify-between">
				<h2 class="text-xl">Comment</h2>
			</div>

			<div class="flex-1">
				<TextBox
					placeholder="Add a comment..."
					onKeyPress={(e) => {
						if (e.key === "Enter") {
							addComment(e.currentTarget.value).then(() => {
								e.currentTarget.value = "";
								historyEventsPull.state !== "pending" && historyEventsPull.refresh();
							});
						}
					}}
				/>
			</div>

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
							historyEventsPull.result.entries.map((event) => <HistoryCard event={event} users={commentUsers} />)}
					</>
				</SkeletonLoader>
			</Paginator>
		</div>
	);
};
