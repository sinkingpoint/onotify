import { AlertCard } from "../../components/AlertCard";
import StatPanel from "../../components/StatPanel";
import { getAlerts } from "../../pkg/api/client";
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

	console.log(alerts);
	return (
		<div class="w-full flex flex-col">
			<h1 class="text-4xl font-bold">Onotify</h1>
			<span class="flex flex-row justify-between w-full">
				<StatPanel title="Firing Alerts" value={1000000} class="w-1/3" />
				<StatPanel title="Silenced Alerts" value={1000000} class="w-1/3" />
				<StatPanel title="Silences" value={1000000} class="w-1/3" />
			</span>

			<h2 class="text-2xl font-bold mt-5">Latest Alerts</h2>
			{alerts.state === "success" && (
				<div>
					{alerts.result.map((a) => {
						console.log(a);
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
