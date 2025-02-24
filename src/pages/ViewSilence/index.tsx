import { ArrowPathIcon } from "@heroicons/react/16/solid";
import { useRoute } from "preact-iso";
import { useMemo, useState } from "preact/hooks";
import { AlertCard } from "../../components/AlertCard";
import { MatcherCard } from "../../components/MatcherCard";
import { getAlerts, GetAlertsResponse, getSilence, postSilence } from "../../pkg/api/client";
import { DataPull, matcherToString, useQuery } from "../../pkg/types/utils";
import { formatDate } from "../AddSilence/utils";

const getHumanNumber = (n: number, one_suffix: string, multiple: string) => {
	if (n === 0) {
		return "None";
	} else if (n === 1) {
		return `1 ${one_suffix}`;
	} else {
		return `${n} ${multiple}`;
	}
};

const getAffectAlertTitle = (affectedAlerts: DataPull<GetAlertsResponse, unknown>) => {
	switch (affectedAlerts.state) {
		case "error":
			return <>Error Fetching Affected Alerts</>;
		case "pending":
			return (
				<span>
					<ArrowPathIcon class="animate-spin inline size-5" />
					Affected Alerts
				</span>
			);
		case "success":
			if (affectedAlerts.result.length === 0) {
				return <>No Affected Alerts</>;
			} else {
				return <>{getHumanNumber(affectedAlerts.result.length, "Affected Alert", "Affected Alerts")}</>;
			}
	}
};

export default () => {
	const location = useRoute();
	const fingerprint = location.params["id"];
	const [reload, setReload] = useState(false);
	const silencePull = useQuery(async () => {
		return getSilence({ path: { id: fingerprint } });
	}, [fingerprint, reload]);

	const affectedAlerts = useQuery(async () => {
		if (silencePull.state !== "success") {
			return null;
		}

		const filter = silencePull.result.matchers.map((m) => matcherToString({ ...m, isEqual: m.isEqual ?? true }));
		return getAlerts({ query: { filter } });
	}, [silencePull]);

	const startTime = useMemo(
		() => (silencePull.state === "success" ? formatDate(new Date(silencePull.result.startsAt)) : ""),
		[silencePull],
	);

	const endTime = useMemo(
		() => (silencePull.state === "success" ? formatDate(new Date(silencePull.result.endsAt)) : ""),
		[silencePull],
	);

	const matchers = useMemo(() => {
		if (silencePull.state !== "success") {
			return [];
		} else {
			return silencePull.result.matchers.map((m) => <MatcherCard matcher={{ ...m, isEqual: m.isEqual ?? true }} />);
		}
	}, [silencePull]);

	const onExpire = async () => {
		if (silencePull.state !== "success") {
			return;
		}

		const newSilence = { ...silencePull.result, endsAt: new Date().toISOString() };
		await postSilence({ body: newSilence });
		setReload(!reload);
	};

	return (
		<div class="flex flex-col p-6">
			<h1>Silence {fingerprint}</h1>
			<span class="pb-3">
				<button class="p-2 bg-red-600 rounded" disabled={silencePull.state !== "success"} onClick={onExpire}>
					Expire
				</button>
			</span>

			<span class="pb-1">
				<h2 class="text-xl inline font-bold">Starts:</h2> {startTime}
			</span>
			<span class="pb-1">
				<h2 class="text-xl inline font-bold">Ends:</h2> {endTime}
			</span>
			<span class="pb-1">
				<h2 class="text-xl font-bold">Matchers:</h2>

				<div class="flex flex-row flex-wrap flex-shrink flex-grow-0">{matchers}</div>
			</span>
			<span class="pb-1">
				<h2 class="text-xl inline pt-4 font-bold">Comment:</h2>{" "}
				{silencePull.state === "success" ? silencePull.result.comment : ""}
			</span>

			<span class="flex flex-col">
				<h2 class="text-xl inline pt-4 font-bold">{getAffectAlertTitle(affectedAlerts)}</h2>
				{affectedAlerts.state === "success" && affectedAlerts.result.map((a) => <AlertCard class="p-3" alert={a} />)}
			</span>
		</div>
	);
};
