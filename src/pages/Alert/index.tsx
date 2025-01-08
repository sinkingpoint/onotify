import { useRoute } from "preact-iso";
import { useEffect, useState } from "preact/hooks";
import { APIClient } from "../../pkg/api";
import { GettableAlert } from "../../pkg/types/api";

interface gotAlertState {
	fetching: boolean;
	alert?: GettableAlert;
}

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

export const AlertPage = () => {
	const [state, setState] = useState<gotAlertState>({
		fetching: true,
	});

	const location = useRoute();
	const fingerprint = location.params["fingerprint"];
	useEffect(() => {
		const fetch = async () => {
			const alerts = await new APIClient().getAlert(fingerprint);
			if (!alerts) {
				// There is no alert with that fingerprint.
				setState({
					fetching: false,
				});

				return;
			}

			setState({
				fetching: false,
				alert: alerts[0],
			});
		};

		fetch();
	}, [fingerprint]);

	const labels = state.alert ? listifyKVs(state.alert.labels) : <></>;
	const annotations = state.alert ? listifyKVs(state.alert.annotations) : <></>;
	const silencedBy = state.alert ? listifyArray(state.alert.status.silencedBy) : <></>;
	const inhibitedBy = state.alert ? listifyArray(state.alert.status.inhibitedBy) : <></>;

	let statusText = "";
	let statusColor = "0xFFFFFF";
	if (state.alert) {
		if (state.alert.endsAt && Date.parse(state.alert.endsAt) <= Date.now()) {
			statusText = "resolved";
			statusColor = "0x0000FF";
		} else if (state.alert.status.silencedBy?.length > 0) {
			statusText = "silenced";
		} else if (state.alert.status.inhibitedBy?.length > 0) {
			statusText = "inhibited";
		}
	}

	return (
		<div class="w-full h-full flex flex-col">
			<h1 class="text-3xl font-bold my-3">Alert {fingerprint}</h1>
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
