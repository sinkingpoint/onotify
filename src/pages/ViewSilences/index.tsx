import { useMemo, useState } from "preact/hooks";
import Paginator from "../../components/Paginator";
import { SilenceCard } from "../../components/SilenceCard";
import { TextBox } from "../../components/TextBox";
import { getSilences, GetSilencesResponse } from "../../pkg/api/client";
import { GettableSilenceSpec } from "../../pkg/types/api";
import { DataPull, useQuery } from "../../pkg/types/utils";

interface ToggleableChitProps {
	value: string;
	toggled: boolean;
	onClick?: (toggled: boolean) => void;
}

const TogglableChit = ({ value, toggled, onClick }: ToggleableChitProps) => {
	let className = "cursor-pointer select-none rounded-xl bg-slate-900	px-3 py-1";
	if (!toggled) {
		className += " line-through decoration-2";
	}

	const handleClick = () => {
		const newToggled = !toggled;
		if (onClick) {
			onClick(newToggled);
		}
	};

	return (
		<span class={className} onClick={handleClick}>
			{value}
		</span>
	);
};

const getSilencePage = (query: DataPull<GetSilencesResponse, unknown>) => {
	if (query.state === "pending") {
		return <div>Loading...</div>;
	}

	if (query.state === "error") {
		return <div>Error: {query.error}</div>;
	}

	const silences = query.result;
	if (silences.length === 0) {
		return <div>No silences found</div>;
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
	const silences = useQuery(() => {
		return getSilences({
			query: {
				page: currentPage,
				limit: DEFAULT_PAGE_SIZE,
				sort: ["startsAt:desc"],
				active: active,
				expired: expired,
			},
		});
	}, [currentPage, active, expired]);

	const numPages = useMemo(() => {
		if (silences.state !== "success") {
			return 1;
		}

		const numSilences = Math.max(parseInt(silences.headers.get("X-Total-Count")), 1);

		return Math.ceil(numSilences / DEFAULT_PAGE_SIZE);
	}, [silences]);

	return (
		<span class="flex flex-col">
			<h1>Silences</h1>
			<span>
				<TextBox placeholder="Filter" />
			</span>
			<span class="py-2">
				<TogglableChit value="Active Silences" toggled={active} onClick={(toggled) => setActive(toggled)} />
				<TogglableChit value="Expired Silences" toggled={expired} onClick={(toggled) => setExpired(toggled)} />
			</span>
			<span>
				<Paginator totalPages={numPages} currentPage={currentPage} setCurrentPage={setCurrentPage} maxPagesInRange={5}>
					{getSilencePage(silences)}
				</Paginator>
			</span>
		</span>
	);
};
