import { AlertCard } from "../../components/AlertCard";
import StatPanel from "../../components/StatPanel";
import { getAlerts, getStats } from "../../pkg/api/client";
import { useQuery } from "../../pkg/types/utils";

const getStatPanel = (title: string, value?: number, error?: string) => {
	console.log(title, value, error);
	return <StatPanel title={title} value={value} error={error} class="w-1/3" />;
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
			<span class="flex flex-row justify-between w-full">
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
			{alerts.state === "success" && (
				<div>
					{alerts.result.map((a) => {
						return (
							<>
								<AlertCard alert={a} />
								<hr />
							</>
						);
					})}
				</div>
			)}
		</div>
	);
};
