import { useState } from "preact/hooks";
import Paginator from "../../components/Paginator";
import { TextBox } from "../../components/TextBox";

interface ToggleableChitProps {
	value: string;
	initialToggled: boolean;
	onClick?: () => void;
}

const TogglableChit = ({ value, initialToggled, onClick }: ToggleableChitProps) => {
	const [toggled, setToggled] = useState(initialToggled);
	let className = "cursor-pointer select-none rounded-xl bg-slate-900	px-3 py-1";
	if (!toggled) {
		className += " line-through decoration-2";
	}

	const handleClick = () => {
		setToggled(!toggled);
		if (onClick) {
			onClick();
		}
	};

	return (
		<span class={className} onClick={handleClick}>
			{value}
		</span>
	);
};

export default () => {
	const [currentPage, setCurrentPage] = useState(1);
	return (
		<div class="flex flex-col">
			<h1>Silences</h1>
			<div>
				<TextBox placeholder="Filter" />
			</div>
			<div>
				<TogglableChit value="Active Silences" initialToggled={true} />
				<TogglableChit value="Expired Silences" initialToggled={false} />
			</div>
			<div>
				<Paginator totalPages={100}></Paginator>
			</div>
		</div>
	);
};
