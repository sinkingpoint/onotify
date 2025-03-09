import { ChevronDoubleLeftIcon, ChevronDoubleRightIcon, EllipsisHorizontalIcon } from "@heroicons/react/16/solid";
import { JSX } from "preact/jsx-runtime";
import "./styles.css";

interface PaginatorProps {
	totalPages: number;
	currentPage: number;
	maxPagesInRange?: number;
	setCurrentPage: (page: number) => void;
	children: JSX.Element | JSX.Element[];
}

const DEFAULT_MAX_PAGES_IN_RANGE = 6;

interface RangeSelectorProps {
	currentPage: number;
	totalPages: number;
	maxPagesInRange: number;
	setCurrentPage: (page: number) => void;
}

const RangeSelector = ({ currentPage, totalPages, maxPagesInRange, setCurrentPage }: RangeSelectorProps) => {
	let startRange = Math.max(currentPage - Math.ceil(maxPagesInRange / 2), 1);
	let endRange = Math.min(startRange + maxPagesInRange, totalPages);

	const getClass = (page: number) => {
		return (
			"select-none cursor-pointer px-2 py-1 rounded-md" +
			(currentPage === page ? " paginator-button-active" : " paginator-button-inactive")
		);
	};

	// This avoids awkward rendering where we render an ellipsis and there's no pages in between
	// the ellipsis and the first/last page.
	if (startRange === 2) {
		startRange--;
	}
	if (endRange === totalPages - 1) {
		endRange++;
	}

	let range = [];
	if (startRange > 1) {
		range.push(
			<span
				class={getClass(1)}
				onClick={() => {
					setCurrentPage(1);
				}}
			>
				1
			</span>,
		);
		range.push(
			<span
				class="px-1 cursor-pointer paginator-ellipsis-container"
				onClick={() => setCurrentPage(Math.max(currentPage - maxPagesInRange, 1))}
			>
				<EllipsisHorizontalIcon class="inline size-4 ml-auto paginator-ellipsis" />
				<ChevronDoubleLeftIcon class="hidden size-4 ml-auto paginator-chevron" />
			</span>,
		);
	}

	for (let i = startRange; i <= endRange; i++) {
		range.push(
			<span
				class={getClass(i)}
				onClick={() => {
					setCurrentPage(i);
				}}
			>
				{i}
			</span>,
		);
	}

	if (endRange < totalPages) {
		range.push(
			<span
				class="px-1 cursor-pointer paginator-ellipsis-container"
				onClick={() => setCurrentPage(Math.min(currentPage + maxPagesInRange, totalPages))}
			>
				<EllipsisHorizontalIcon class="inline size-4 ml-auto paginator-ellipsis" />
				<ChevronDoubleRightIcon class="hidden size-4 ml-auto paginator-chevron" />
			</span>,
		);
		range.push(
			<span
				class={getClass(totalPages)}
				onClick={() => {
					setCurrentPage(totalPages);
				}}
			>
				{totalPages}
			</span>,
		);
	}

	return <span class="mt-3">{range}</span>;
};

export default ({ totalPages, children, currentPage, maxPagesInRange, setCurrentPage }: PaginatorProps) => {
	if (currentPage > totalPages) {
		setCurrentPage(totalPages);
	}

	return (
		<span class="flex flex-col">
			<div>{children}</div>
			<>
				{totalPages > 0 && (
					<RangeSelector
						currentPage={currentPage}
						setCurrentPage={setCurrentPage}
						totalPages={totalPages}
						maxPagesInRange={maxPagesInRange ?? DEFAULT_MAX_PAGES_IN_RANGE}
					/>
				)}
			</>
		</span>
	);
};
