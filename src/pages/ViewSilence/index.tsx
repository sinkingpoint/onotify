import { ArrowPathIcon } from "@heroicons/react/16/solid";
import { useRoute } from "preact-iso";
import { useMemo, useState } from "preact/hooks";
import { AlertCard } from "../../components/AlertCard";
import { MatcherCard } from "../../components/MatcherCard";
import Paginator from "../../components/Paginator";
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
				return (
					<>
						{getHumanNumber(parseInt(affectedAlerts.headers.get("X-Total-Count")), "Affected Alert", "Affected Alerts")}
					</>
				);
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

	const silence = silencePull.state === "success" && silencePull.result ? silencePull.result : undefined;

	const [currentPage, setCurrentPage] = useState(1);
	const affectedAlerts = useQuery(() => {
		if (silencePull.state !== "success") {
			return;
		}

		return getAlerts({
			query: {
				page: currentPage,
				limit: 10,
				sort: ["startsAt:desc"],
				filter: silencePull.result.matchers.map((m) => matcherToString({ isEqual: true, ...m })),
			},
		});
	}, [silencePull, currentPage]);

	const numPages = useMemo(() => {
		if (affectedAlerts.state !== "success") {
			return 1;
		}

		const numSilences = Math.max(parseInt(affectedAlerts.headers.get("X-Total-Count")), 1);

		return Math.ceil(numSilences / 10);
	}, [affectedAlerts]);

	const startTime = useMemo(() => (silence ? formatDate(new Date(silence.startsAt)) : ""), [silencePull]);
	const endTime = useMemo(() => (silence ? formatDate(new Date(silence.endsAt)) : ""), [silencePull]);

	const matchers = useMemo(() => {
		if (silencePull.state !== "success") {
			return [];
		}

		return silence.matchers.map((m) => <MatcherCard matcher={{ ...m, isEqual: m.isEqual ?? true }} />);
	}, [silencePull]);

	const onExpire = async () => {
		if (silencePull.state !== "success") {
			return;
		}

		const newSilence = { ...silencePull.result, endsAt: new Date().toISOString() };
		await postSilence({ body: newSilence });
		setReload(!reload);
	};

	const startText = (() => {
		if (!silence || Date.parse(silence.startsAt) < Date.now()) {
			return "Started";
		}

		return "Started";
	})();

	const endText = (() => {
		if (!silence || Date.parse(silence.endsAt) > Date.now()) {
			return "Ends";
		}

		return "Ended";
	})();

	const buttons = [];
	if (silence) {
		if (Date.now() < Date.parse(silence.endsAt)) {
			buttons.push(
				<button class="p-2 bg-[color:--error] rounded" disabled={silencePull.state !== "success"} onClick={onExpire}>
					Expire
				</button>,
			);
		} else {
			const recreateArgs = silence.matchers.map(
				(m) => `matcher=${matcherToString({ ...m, isEqual: m.isEqual ?? true })}`,
			);
			recreateArgs.push(`comment=${silence.comment ?? ""}`);

			buttons.push(
				<a href={`/silences/new?${recreateArgs.join("&")}`}>
					<button
						class="p-2 bg-[color:--highlight] rounded"
						disabled={silencePull.state !== "success"}
						onClick={onExpire}
					>
						Recreate
					</button>
				</a>,
			);
		}
	}

	return (
		<div class="flex flex-col p-6">
			<h1>Silence {fingerprint}</h1>
			<span class="pb-3">{buttons}</span>

			<span>
				<h2 class="text-xl inline font-bold">{startText} at:</h2> {startTime}
			</span>
			<span>
				<h2 class="text-xl inline font-bold">{endText} at:</h2> {endTime}
			</span>
			<span>
				<h2 class="text-xl font-bold">Matchers:</h2>
				<div class="flex flex-row flex-wrap flex-shrink flex-grow-0">{matchers}</div>
			</span>
			<span>
				<h2 class="text-xl inline pt-4 font-bold">Comment:</h2>{" "}
				{silencePull.state === "success" ? silencePull.result.comment : ""}
			</span>

			<span class="flex flex-col">
				<h2 class="text-xl inline pt-4 font-bold">{getAffectAlertTitle(affectedAlerts)}</h2>
				<Paginator
					totalPages={numPages}
					currentPage={currentPage}
					setCurrentPage={setCurrentPage}
					maxPagesInRange={5}
					class="w-full"
				>
					{affectedAlerts.state === "success" && affectedAlerts.result.map((a) => <AlertCard class="p-3" alert={a} />)}
				</Paginator>
			</span>
		</div>
	);
};
