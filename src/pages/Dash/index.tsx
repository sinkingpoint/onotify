import { AlertCard } from "../../components/AlertCard";
import InfoBox from "../../components/InfoBox";
import { SkeletonLoader } from "../../components/Skeleton";
import StatPanel from "../../components/StatPanel";
import { getAlerts, GetAlertsResponse, getStats } from "../../pkg/api/client";
import { DataPull, useQuery } from "../../pkg/types/utils";

const getStatPanel = (title: string, value?: number, error?: string) => {
	return <StatPanel title={title} value={value} error={error} />;
};

const getAlertCards = (pull: DataPull<GetAlertsResponse, unknown>) => {
	if (pull.state === "pending") {
		// Pending pulls are masked by the skeleton loader.
		return <></>;
	}

	if (pull.state === "error") {
		return <InfoBox style="error" text="Failed to load alerts" />;
	}

	if (pull.result.length === 0) {
		return <InfoBox style="info" text="No alerts! Hooray!" class="w-full" />;
	}

	return (
		<>
			{pull.result.map((a) => (
				<AlertCard alert={a} />
			))}
		</>
	);
};

export const Dash = () => {
	const alerts = useQuery(
		() =>
			getAlerts({
				query: {
					sort: ["startsAt:desc"],
					limit: 20,
				},
			}),
		[],
	);

	const alertStats = useQuery(
		() =>
			getStats({
				path: {
					resourceType: "alerts",
				},
				query: {},
			}),
		[],
	);

	const silencedAlertStats = useQuery(
		() =>
			getStats({
				path: {
					resourceType: "alerts",
				},
				query: {
					active: false,
					silenced: true,
				},
			}),
		[],
	);

	const silenceStats = useQuery(
		() =>
			getStats({
				path: {
					resourceType: "silences",
				},
				query: {},
			}),
		[],
	);

	return (
		<div class="w-full flex flex-col">
			<span class="flex flex-col md:flex-row justify-between w-full overflow-wrap gap-5">
				{getStatPanel(
					"Firing Alerts",
					alertStats.state === "success" ? (alertStats.result.buckets[0]?.value ?? 0) : undefined,
					alertStats.state === "error" ? alertStats.error.toString() : undefined,
				)}
				{getStatPanel(
					"Silenced Alerts",
					silencedAlertStats.state === "success" ? (silencedAlertStats.result.buckets[0]?.value ?? 0) : undefined,
					silencedAlertStats.state === "error" ? silencedAlertStats.error.toString() : undefined,
				)}
				{getStatPanel(
					"Silences",
					silenceStats.state === "success" ? (silenceStats.result.buckets[0]?.value ?? 0) : undefined,
					silenceStats.state === "error" ? silenceStats.error.toString() : undefined,
				)}
			</span>

			<h2 class="text-2xl font-bold mt-5">Latest Alerts</h2>
			<span class="w-full flex flex-col">
				<SkeletonLoader layout="paragraph" repeat={3} pull={alerts}>
					{getAlertCards(alerts)}
				</SkeletonLoader>
			</span>
		</div>
	);
};
