import { AlertCard } from "../../components/AlertCard";
import StatPanel from "../../components/StatPanel";
import { getAlerts, getStats } from "../../pkg/api/client";
import { useQuery } from "../../pkg/types/utils";

export const Dash = () => {
	const alerts = useQuery(
		() =>
			getAlerts({
				query: {
					sort: ["startsAt:desc"],
					limit: 20,
				},
			}),
		[]
	);

	const alertStats = useQuery(
		() =>
			getStats({
				path: {
					resourceType: "alerts",
				},
				query: {},
			}),
		[]
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
		[]
	);

	const silenceStats = useQuery(
		() =>
			getStats({
				path: {
					resourceType: "silences",
				},
				query: {},
			}),
		[]
	);

	return (
		<div class="w-full flex flex-col">
			<h1 class="text-4xl font-bold">Onotify</h1>
			<span class="flex flex-row justify-between w-full">
				<StatPanel
					title="Firing Alerts"
					value={alertStats.state === "success" ? alertStats.result.buckets[0].value : 0}
					class="w-1/3"
				/>
				<StatPanel
					title="Silenced Alerts"
					value={silencedAlertStats.state === "success" ? silencedAlertStats.result.buckets[0].value : 0}
					class="w-1/3"
				/>
				<StatPanel
					title="Silences"
					value={silenceStats.state === "success" ? silenceStats.result.buckets[0].value : 0}
					class="w-1/3"
				/>
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
