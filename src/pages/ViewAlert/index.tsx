import { useRoute } from "preact-iso";
import { useMemo } from "preact/hooks";
import { getAlerts, GetAlertsResponse } from "../../pkg/api/client";
import { useQuery } from "../../pkg/types/utils";

type LinkFunc = (val: string, key?: string) => string;

const listifyKVs = (labels?: Record<string, string>, link?: LinkFunc) => {
	if (labels && Object.keys(labels).length > 0) {
		return (
			<ul>
				{Object.keys(labels).map((k) => {
					let entry = (
						<>
							{k} = "{labels[k]}"
						</>
					);

					if (link) {
						const linkURL = link(labels[k], k);
						entry = <a href={linkURL}>{entry}</a>;
					}

					return <li>{entry}</li>;
				})}
			</ul>
		);
	} else {
		return <span class="italic">None</span>;
	}
};

const listifyArray = (values?: string[], link?: LinkFunc) => {
	if (values && values.length > 0) {
		return (
			<ul>
				{values.map((k) => {
					let entry = <>{k}</>;

					if (link) {
						const linkURL = link(k);
						entry = <a href={linkURL}>{entry}</a>;
					}

					return <li>{entry}</li>;
				})}
			</ul>
		);
	} else {
		return <span class="italic">None</span>;
	}
};

const getStatusText = (alerts: GetAlertsResponse) => {
	const alert = alerts[0];
	if (alert.endsAt && Date.parse(alert.endsAt) <= Date.now()) {
		return "resolved";
	} else if (alert.status.silencedBy?.length > 0) {
		return "silenced";
	} else if (alert.status.inhibitedBy?.length > 0) {
		return "inhibited";
	}
};

export default () => {
	const location = useRoute();
	const fingerprint = location.params["fingerprint"];
	const alert = useQuery(() => getAlerts({ query: { fingerprints: [fingerprint] } }), [fingerprint]);
	const hasPulled = alert.state === "success" && alert.result.length > 0;

	const labels = useMemo(() => (hasPulled ? listifyKVs(alert.result[0].labels) : <></>), [alert]);
	const annotations = useMemo(() => (hasPulled ? listifyKVs(alert.result[0].annotations) : <></>), [alert]);
	const silencedBy = useMemo(() => (hasPulled ? listifyArray(alert.result[0].status.silencedBy) : <></>), [alert]);
	const inhibitedBy = useMemo(() => (hasPulled ? listifyArray(alert.result[0].status.inhibitedBy) : <></>), [alert]);
	const statusText = useMemo(() => (hasPulled ? getStatusText(alert.result) : ""), [alert]);

	return (
		<div class="w-full h-full flex flex-col">
			<h1>Alert {fingerprint}</h1>
			<div>
				<span class="text-xl">Status: </span>
				{statusText}
			</div>
			<div class="flex flex-row justify-between my-5">
				<div class="basis-1/2">
					<h2 class="text-xl">Labels</h2>
					{labels}
				</div>

				<div class="basis-1/2">
					<h2 class="text-xl">Annotations</h2>
					{annotations}
				</div>
			</div>

			<div class="flex flex-row justify-between">
				<div class="basis-1/2">
					<h2 class="text-xl">Silenced By</h2>
					{silencedBy}
				</div>

				<div class="basis-1/2">
					<h2 class="text-xl">Inhibited By</h2>
					{inhibitedBy}
				</div>
			</div>
		</div>
	);
};
