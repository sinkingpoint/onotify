import { useMemo, useState } from "preact/hooks";
import FilterInput from "../../components/FilterInput";
import InfoBox from "../../components/InfoBox";
import Paginator from "../../components/Paginator";
import { SilenceCard } from "../../components/SilenceCard";
import { SkeletonLoader } from "../../components/Skeleton";
import TogglableChit from "../../components/TogglableChit";
import { getSilences, GetSilencesResponse } from "../../pkg/api/client";
import { GettableSilenceSpec, Matcher } from "../../pkg/types/api";
import { DataPull, matcherToString, setURLParam, useQuery } from "../../pkg/types/utils";
import { matcherIsSame } from "../../pkg/utils/matcher";

const getSilencePage = (query: DataPull<GetSilencesResponse, unknown>) => {
	if (query.state === "pending") {
		// Pending pulls get masked by the skeleton loader.
		return <></>;
	}

	if (query.state === "error") {
		return <InfoBox style="error" text="Failed to fetch silences" class="my-1 w-full" />;
	}

	const silences = query.result;
	if (silences.length === 0) {
		return <InfoBox style="warn" text="No silences found" class="my-1 w-full" />;
	}

	return (
		<div>
			{silences.map((s) => (
				<SilenceCard class="pb-3" silence={GettableSilenceSpec.parse(s)} />
			))}
		</div>
	);
};

export default () => {
	const DEFAULT_PAGE_SIZE = 10;
	const [currentPage, setCurrentPage] = useState(1);
	const [active, setActive] = useState(true);
	const [expired, setExpired] = useState(false);

	const [matchers, setMatchers] = useState([]);
	const silences = useQuery(() => {
		return getSilences({
			query: {
				page: currentPage,
				limit: DEFAULT_PAGE_SIZE,
				matcher: matchers.map((m) => matcherToString(m)),
				sort: ["startsAt:desc"],
				active: active,
				expired: expired,
			},
		});
	}, [currentPage, active, expired, matchers]);

	const numPages = useMemo(() => {
		if (silences.state !== "success") {
			return 1;
		}

		const numSilences = Math.max(parseInt(silences.headers.get("X-Total-Count")), 1);

		return Math.ceil(numSilences / DEFAULT_PAGE_SIZE);
	}, [silences]);

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
			<h1>Silences</h1>
			<span>
				<h3>Filter</h3>
				<FilterInput handleNewMatcher={handleNewMatcher} removeMatcher={removeMatcher} matchers={matchers} />
			</span>
			<span class="py-2">
				<TogglableChit
					value="Active Silences"
					toggled={active}
					class="mr-2"
					onClick={(toggled) => setActive(toggled)}
				/>
				<TogglableChit value="Expired Silences" toggled={expired} onClick={(toggled) => setExpired(toggled)} />
			</span>
			<span>
				<Paginator
					totalPages={numPages}
					currentPage={currentPage}
					setCurrentPage={setCurrentPage}
					maxPagesInRange={5}
					class="w-1/2"
				>
					<SkeletonLoader pull={silences} layout="paragraph" repeat={3}>
						{getSilencePage(silences)}
					</SkeletonLoader>
				</Paginator>
			</span>
		</span>
	);
};
