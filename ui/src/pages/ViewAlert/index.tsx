import { useRoute } from "preact-iso";
import { SkeletonLoader } from "../../components/Skeleton";
import { Tab, TabPane } from "../../components/TabPane";
import { getAlerts } from "../../pkg/api/client";
import { useQuery } from "../../pkg/types/utils";
import HistoryPane from "./historyPane";
import StatusPane from "./statusPane";

export default () => {
	const location = useRoute();
	const fingerprint = location.params["fingerprint"];
	const alertPull = useQuery(
		() => getAlerts({ query: { fingerprints: [fingerprint], resolved: true } }),
		[fingerprint],
	);
	const alert = alertPull.state === "success" && alertPull.result.length ? alertPull.result[0] : undefined;

	return (
		<div class="w-full h-full flex flex-col">
			<SkeletonLoader layout="single-line" pull={alertPull}>
				<h1>
					{!!alert && "alertname" in alert.labels ? alert.labels["alertname"] : <i class="italic">No Alert Name</i>}
				</h1>
			</SkeletonLoader>

			<TabPane>
				<Tab name="Status">
					<StatusPane alertPull={alertPull} fingerprint={fingerprint} />
				</Tab>

				<Tab name="History">
					<HistoryPane fingerprint={fingerprint} />
				</Tab>
			</TabPane>
		</div>
	);
};
