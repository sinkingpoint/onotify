import { useState } from "preact/hooks";
import { JSX } from "preact/jsx-runtime";
import "./styles.css";

interface PaginatorProps {
	totalPages: number;
	children: JSX.Element[];
}

const MAX_PAGES_IN_RANGE = 6;

interface RangeSelectorProps {
	currentPage: number;
	totalPages: number;
	setCurrentPage: (page: number) => void;
}

const RangeSelector = ({ currentPage, totalPages, setCurrentPage }: RangeSelectorProps) => {
	const startRange = Math.max(currentPage - Math.ceil(MAX_PAGES_IN_RANGE / 2), 1);
	const endRange = Math.min(startRange + MAX_PAGES_IN_RANGE, totalPages);
	let range = [];
	for (let i = startRange; i <= endRange; i++) {
		range.push(
			<span
				class={"px-1 paginator-button" + (currentPage === i ? " font-extrabold" : "")}
				onClick={() => {
					setCurrentPage(i);
				}}
			>
				{i}
			</span>,
		);
	}

	if (endRange < totalPages) {
		range.push(<span class="px-1">...</span>);
		range.push(
			<span
				class="px-1 paginator-button"
				onClick={() => {
					setCurrentPage(totalPages);
				}}
			>
				{totalPages}
			</span>,
		);
	}

	return <span>{range}</span>;
};

export default ({ totalPages, children }: PaginatorProps) => {
	const [currentPage, setCurrentPage] = useState(1);

	return (
		<div>
			{children}
			<RangeSelector currentPage={currentPage} setCurrentPage={setCurrentPage} totalPages={totalPages} />
		</div>
	);
};
