import { useMemo, useState } from "preact/hooks";
import { AlertCard } from "../../components/AlertCard";
import FilterInput from "../../components/FilterInput";
import InfoBox from "../../components/InfoBox";
import Paginator from "../../components/Paginator";
import { SkeletonLoader } from "../../components/Skeleton";
import TogglableChit from "../../components/TogglableChit";
import { getAlerts, GetAlertsResponse } from "../../pkg/api/client";
import { StringMatcherSpec } from "../../pkg/types/alertmanager";
import { Matcher } from "../../pkg/types/api";
import { DataPull, matcherToString, setURLParam, useQuery } from "../../pkg/types/utils";
import { matcherIsSame } from "../../pkg/utils/matcher";
import { getURLSearchParams } from "../../pkg/utils/preact-shims";

const DEFAULT_PAGE_SIZE = 10;

const getAlertsPage = (query: DataPull<GetAlertsResponse, unknown>) => {
	if (query.state === "pending") {
		// Pending pulls get masked by the skeleton loader.
		return <></>;
	}

	if (query.state === "error") {
		return <InfoBox style="error" text="Failed to fetch alerts" class="my-1 w-1/2" />;
	}

	const alerts = query.result;
	if (alerts.length === 0) {
		return <InfoBox style="warn" text="No alerts found" class="my-1 w-1/2" />;
	}

	return (
		<div>
			{alerts.map((a) => (
				<AlertCard class="pb-3" alert={a} />
			))}
		</div>
	);
};

export default () => {
	const params = getURLSearchParams();
	const [matchers, setMatchers] = useState(params.getAll("filter").map((m) => StringMatcherSpec.parse(m)));
	const [active, setActive] = useState((params.get("active") ?? "true") === "true");
	const [silenced, setSilenced] = useState((params.get("silenced") ?? "false") === "true");
	const [inhibited, setInihibited] = useState((params.get("inhibited") ?? "false") === "true");
	const [muted, setMuted] = useState((params.get("muted") ?? "false") === "true");
	const [resolved, setResolved] = useState((params.get("resolved") ?? "false") === "true");
	const [currentPage, setCurrentPage] = useState(1);

	const alerts = useQuery(() => {
		return getAlerts({
			query: {
				active,
				silenced,
				inhibited,
				muted,
				resolved,
				page: currentPage,
				limit: DEFAULT_PAGE_SIZE,
				sort: ["startsAt:desc"],
				filter: matchers.map((m) => matcherToString(m)),
			},
		});
	}, [matchers, active, silenced, inhibited, resolved, muted, currentPage]);

	const numPages = useMemo(() => {
		if (alerts.state !== "success") {
			return 1;
		}

		const numSilences = Math.max(parseInt(alerts.headers.get("X-Total-Count")), 1);

		return Math.ceil(numSilences / DEFAULT_PAGE_SIZE);
	}, [alerts]);

	const setMatchersInURLParams = (matchers: Matcher[]) => {
		setURLParam(
			"filter",
			matchers.map((m) => matcherToString(m)),
		);

		setMatchers(matchers);
	};

	const handleNewMatcher = (matcher: Matcher) => {
		if (!matchers.some((m) => matcherIsSame(matcher, m))) {
			setMatchersInURLParams([...matchers, matcher]);
		}
	};

	const removeMatcher = (matcher: Matcher) => {
		const idx = matchers.findIndex((m) => matcherIsSame(matcher, m));
		if (idx !== -1) {
			matchers.splice(idx, 1);
			setMatchersInURLParams([...matchers]);
		}
	};

	return (
		<span class="flex flex-col w-full">
			<h1>Alerts</h1>
			<span>
				<h3>Filter</h3>
				<FilterInput handleNewMatcher={handleNewMatcher} removeMatcher={removeMatcher} matchers={matchers} />
			</span>

			<span class="py-2 flex flex-row flex-wrap gap-2">
				<TogglableChit
					value="Active Alerts"
					toggled={active}
					onClick={(toggled) => {
						setActive(toggled);
						setURLParam("active", toggled);
					}}
				/>
				<TogglableChit
					value="Silenced Alerts"
					toggled={silenced}
					onClick={(toggled) => {
						setSilenced(toggled);
						setURLParam("silenced", toggled);
					}}
				/>
				<TogglableChit
					value="Inhibited Alerts"
					toggled={inhibited}
					onClick={(toggled) => {
						setURLParam("inhibited", toggled);
						setInihibited(toggled);
					}}
				/>
				<TogglableChit
					value="Muted Alerts"
					toggled={muted}
					onClick={(toggled) => {
						setMuted(toggled);
						setURLParam("muted", toggled);
					}}
				/>
				<TogglableChit
					value="Resolved Alerts"
					toggled={resolved}
					onClick={(toggled) => {
						setResolved(toggled);
						setURLParam("resolved", toggled);
					}}
				/>
			</span>

			<span>
				<Paginator
					totalPages={numPages}
					currentPage={currentPage}
					setCurrentPage={setCurrentPage}
					maxPagesInRange={5}
					class="w-full"
				>
					<SkeletonLoader pull={alerts} layout="paragraph" repeat={DEFAULT_PAGE_SIZE / 2}>
						{getAlertsPage(alerts)}
					</SkeletonLoader>
				</Paginator>
			</span>
		</span>
	);
};
