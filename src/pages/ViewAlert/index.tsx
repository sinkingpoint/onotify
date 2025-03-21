import { useRoute } from "preact-iso";
import { JSX } from "preact/jsx-runtime";
import { AlertCard } from "../../components/AlertCard";
import InfoBox from "../../components/InfoBox";
import { MatcherCard } from "../../components/MatcherCard";
import { SilenceCard } from "../../components/SilenceCard";
import { SkeletonLoader } from "../../components/Skeleton";
import { getAlerts, GetAlertsResponse, getSilences, GetSilencesResponse, postAlerts } from "../../pkg/api/client";
import { GettableSilenceSpec } from "../../pkg/types/api";
import { DataPull, matcherToString, useQuery } from "../../pkg/types/utils";

const silenceCards = (pull: DataPull<GetSilencesResponse, any>) => {
	if (!pull || pull.state === "pending") {
		return;
	}

	if (pull.state === "error") {
		return <InfoBox style="error" text="Failed to pull silences" />;
	}

	return pull.result.map((s) => <SilenceCard silence={GettableSilenceSpec.parse(s) as any} />);
};

const inhibitedCards = (pull: DataPull<GetAlertsResponse, any>) => {
	if (!pull || pull.state === "pending") {
		return;
	}

	if (pull.state === "error") {
		return <InfoBox style="error" text="Failed to pull silences" />;
	}

	return pull.result.map((a) => <AlertCard alert={a} />);
};

export default () => {
	const location = useRoute();
	const fingerprint = location.params["fingerprint"];
	const alertPull = useQuery(
		() => getAlerts({ query: { fingerprints: [fingerprint], resolved: true } }),
		[fingerprint],
	);
	const alert = alertPull.state === "success" && alertPull.result.length ? alertPull.result[0] : undefined;
	const silencePull = (() => {
		if (alert && alert.status.silencedBy.length > 0) {
			return useQuery(
				() =>
					getSilences({
						query: {
							id: alert.status.silencedBy,
							active: true,
							expired: true,
						},
					}),
				[alert],
			);
		}

		return undefined;
	})();

	const inhibitedPull = (() => {
		if (alert && alert.status.inhibitedBy.length > 0) {
			return useQuery(
				() =>
					getAlerts({
						query: {
							fingerprints: alert.status.inhibitedBy,
						},
					}),
				[alert],
			);
		}

		return undefined;
	})();

	const onSilenceAlert = () => {
		if (alert) {
			const matchers = Object.keys(alert.labels)
				.map((k) => ({
					name: k,
					value: alert.labels[k],
					isRegex: false,
					isEqual: true,
				}))
				.map((m) => `matcher=${matcherToString(m)}`)
				.join("&");

			window.location.href = `/silences/new?${matchers}`;
		}
	};

	const onReopen = async () => {
		if (alertPull.state === "success" && alert) {
			alert.endsAt = new Date(Date.now() + 1000 * 60 * 60).toISOString();
			await postAlerts({ body: [alert] });
			alertPull.refresh();
		}
	};

	const onResolve = async () => {
		if (alertPull.state === "success" && alert) {
			alert.endsAt = new Date(Date.now()).toISOString();
			await postAlerts({ body: [alert] });
			alertPull.refresh();
		}
	};

	const statusText = (() => {
		if (!alert) {
			return "";
		}
		switch (alert.status.state) {
			case "active":
				const alertEnd = alert.endsAt ? Date.parse(alert.endsAt) : 0;
				if (alertEnd !== 0 && alertEnd < Date.now()) {
					return "Resolved";
				} else {
					return "Active";
				}
			case "supressed":
				return "Supressed";
		}
	})();

	let contents: JSX.Element;
	if (alertPull.state === "error") {
		contents = <InfoBox text="Failed to get alert" style="error" />;
	} else if (alertPull.state === "success" && alertPull.result.length === 0) {
		contents = <InfoBox text={`No such alert: ${fingerprint}`} style="error" />;
	} else {
		contents = (
			<>
				<div class="flex gap-3 flex-wrap my-3">
					{statusText != "" && statusText !== "Resolved" && (
						<>
							<button class="p-2 bg-green-600 rounded whitespace-nowrap" onClick={onSilenceAlert}>
								Silence Alert
							</button>

							<button class="p-2 bg-green-600 rounded whitespace-nowrap" onClick={onResolve}>
								Resolve Alert
							</button>
						</>
					)}

					{statusText === "Resolved" && (
						<button class="p-2 bg-green-600 rounded" onClick={onReopen}>
							Re-Open Alert
						</button>
					)}
				</div>
				<div>
					<h2 class="text-xl inline">Status: </h2>
					<SkeletonLoader layout="single-line" pull={alertPull}>
						<span>{statusText}</span>
					</SkeletonLoader>
				</div>
				<div class="flex flex-col md:flex-row justify-between gap-5">
					<div class="basis-1/2">
						<h2 class="text-xl">Labels</h2>
						<span class="flex flex-wrap">
							<SkeletonLoader pull={alertPull} layout="paragraph">
								{alert && Object.keys(alert.labels).length > 0 ? (
									Object.keys(alert.labels).map((k) => (
										<MatcherCard matcher={{ isEqual: true, isRegex: false, name: k, value: alert.labels[k] }} />
									))
								) : (
									<i>None</i>
								)}
							</SkeletonLoader>
						</span>
					</div>

					<div class="basis-1/2">
						<h2 class="text-xl">Annotations</h2>
						<SkeletonLoader pull={alertPull} layout="paragraph">
							{alert && Object.keys(alert.annotations).length > 0 ? (
								Object.keys(alert.annotations).map((k) => (
									<MatcherCard matcher={{ isEqual: true, isRegex: false, name: k, value: alert.annotations[k] }} />
								))
							) : (
								<i>None</i>
							)}
						</SkeletonLoader>
					</div>
				</div>

				<div class="flex flex-col md:flex-row justify-between gap-5">
					<div class="basis-1/2">
						<h2 class="text-xl">Silenced By</h2>
						<SkeletonLoader pull={silencePull ?? alertPull} layout="paragraph">
							{alert && alert.status.silencedBy.length > 0 ? silenceCards(silencePull) : <i>None</i>}
						</SkeletonLoader>
					</div>

					<div class="basis-1/2">
						<h2 class="text-xl">Inhibited By</h2>
						<SkeletonLoader pull={inhibitedPull ?? alertPull} layout="paragraph">
							{alert && alert.status.inhibitedBy.length > 0 ? inhibitedCards(inhibitedPull) : <i>None</i>}
						</SkeletonLoader>
					</div>
				</div>
			</>
		);
	}

	return (
		<div class="w-full h-full flex flex-col">
			<h1>
				Alert {fingerprint} (
				{!!alert && "alertname" in alert.labels ? alert.labels["alertname"] : <i class="italic">No Alert Name</i>})
			</h1>

			{contents}
		</div>
	);
};
