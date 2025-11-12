import { useMemo, useState } from "preact/hooks";
import Dropdown from "../../components/Dropdown";
import FilterInput from "../../components/FilterInput";
import InfoBox from "../../components/InfoBox";
import Paginator from "../../components/Paginator";
import { SkeletonLoader } from "../../components/Skeleton";
import { getAlertHistory, GetAlertHistoryResponse, getAlerts, GetAlertsResponse } from "../../pkg/api/client";
import { StringMatcherSpec } from "../../pkg/types/alertmanager";
import { Matcher } from "../../pkg/types/api";
import { DataPull, matcherToString, setURLParam, useQuery } from "../../pkg/types/utils";
import { matcherIsSame } from "../../pkg/utils/matcher";
import { getURLSearchParams } from "../../pkg/utils/preact-shims";
import { HistoryEventCard } from "./historyEventCard";

const DEFAULT_PAGE_SIZE = 10;

const getHistoryPage = (
	query: DataPull<GetAlertHistoryResponse, unknown>,
	alerts: Map<string, GetAlertsResponse[number]>,
) => {
	if (query.state === "pending") {
		return <></>;
	}

	if (query.state === "error") {
		return <InfoBox style="error" text="Failed to fetch alert history" class="my-1 w-1/2" />;
	}

	const history = query.result;
	if (!history || history.entries.length === 0) {
		return <InfoBox style="warn" text="No history found" class="my-1 w-1/2" />;
	}

	return (
		<div class="space-y-3">
			{history.entries.map((event, idx) => (
				<HistoryEventCard key={idx} event={event} alert={alerts.get(event.fingerprint)} />
			))}
		</div>
	);
};

const formatDateTimeLocal = (date: Date): string => {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	const hours = String(date.getHours()).padStart(2, "0");
	const minutes = String(date.getMinutes()).padStart(2, "0");
	return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export default () => {
	const now = new Date();
	const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

	const params = getURLSearchParams();
	const initialStartTime = formatDateTimeLocal(new Date(params.get("startTime") || oneWeekAgo));
	const initialEndTime = formatDateTimeLocal(new Date(params.get("endTime") || now));
	const [startTime, setStartTime] = useState(initialStartTime);
	const [endTime, setEndTime] = useState(initialEndTime);
	const [matchers, setMatchers] = useState(params.getAll("filter").map((m) => StringMatcherSpec.parse(m)));
	const [currentPage, setCurrentPage] = useState(1);

	const history = useQuery(() => {
		return getAlertHistory({
			query: {
				startTime: `${formatDateTimeLocal(new Date(startTime))}+00:00`,
				endTime: `${formatDateTimeLocal(new Date(endTime))}+00:00`,
				active: true,
				silenced: true,
				inhibited: true,
				muted: true,
				resolved: true,
				page: currentPage,
				limit: DEFAULT_PAGE_SIZE,
				filter: matchers.map((m) => matcherToString(m)),
			},
		});
	}, [startTime, endTime, matchers, currentPage]);

	const alerts = useQuery(() => {
		if (history.state !== "success") {
			return;
		}

		const fingerprints = history.result.entries.map((entry) => entry.fingerprint);
		return getAlerts({
			query: {
				fingerprints,
			},
		});
	}, [history]);

	const alertMap = useMemo(() => {
		if (alerts.state !== "success") {
			return new Map<string, GetAlertsResponse[number]>();
		}

		const map = new Map<string, GetAlertsResponse[number]>();
		for (const alert of alerts.result) {
			map.set(alert.fingerprint, alert);
		}
		return map;
	}, [alerts]);

	const numPages = useMemo(() => {
		if (history.state !== "success") {
			return 1;
		}

		const totalCount = parseInt(history.headers?.get("X-Total-Count") || "0");
		return Math.ceil(totalCount / DEFAULT_PAGE_SIZE);
	}, [history]);

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

	const onExport = async (option: string) => {
		const getAcceptHeader = (opt: string) => {
			switch (opt) {
				case "csv":
					return "text/csv";
				case "json":
					return "application/json";
				case "pdf":
					return "application/pdf";
			}
		};

		const response = await getAlertHistory({
			query: {
				startTime: `${formatDateTimeLocal(new Date(startTime))}+00:00`,
				endTime: `${formatDateTimeLocal(new Date(endTime))}+00:00`,
				active: true,
				silenced: true,
				inhibited: true,
				muted: true,
				resolved: true,
				filter: matchers.map((m) => matcherToString(m)),
			},
			headers: {
				Accept: getAcceptHeader(option),
			},
			parseAs: "blob",
		});

		const blob = response.data as unknown as Blob;
		const url = URL.createObjectURL(blob);
		window.open(url, "_blank").focus();
	};

	return (
		<div class="flex flex-col w-full space-y-4">
			<h1>Alert History</h1>

			<div class="space-y-4">
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div>
						<label class="block text-sm font-medium mb-2">Start Time</label>
						<input
							type="datetime-local"
							value={startTime}
							class="w-full p-2 border rounded"
							style="background-color: var(--bg-color); border-color: var(--border-color); color: var(--text-color);"
							onChange={(e) => {
								setStartTime(e.currentTarget.value);
								setURLParam("startTime", e.currentTarget.value);
							}}
						/>
					</div>
					<div>
						<label class="block text-sm font-medium mb-2">End Time</label>
						<input
							type="datetime-local"
							value={endTime}
							class="w-full p-2 border rounded"
							style="background-color: var(--bg-color); border-color: var(--border-color); color: var(--text-color);"
							onChange={(e) => {
								setEndTime(e.currentTarget.value);
								setURLParam("endTime", e.currentTarget.value);
							}}
						/>
					</div>
				</div>

				<label class="block text-sm font-medium mb-2">Filter</label>
				<div class="flex flex-row">
					<FilterInput handleNewMatcher={handleNewMatcher} removeMatcher={removeMatcher} matchers={matchers} />
					<Dropdown
						options={[
							{ label: "Export as CSV", value: "csv" },
							{ label: "Export as JSON", value: "json" },
						]}
						baseText="Export"
						class="ml-auto"
						onSelectOption={onExport}
					/>
				</div>
			</div>

			<div>
				<Paginator
					totalPages={numPages}
					currentPage={currentPage}
					setCurrentPage={setCurrentPage}
					maxPagesInRange={5}
					class="w-full"
				>
					<SkeletonLoader pull={history} layout="paragraph" repeat={DEFAULT_PAGE_SIZE / 4}>
						{getHistoryPage(history, alertMap)}
					</SkeletonLoader>
				</Paginator>
			</div>
		</div>
	);
};
