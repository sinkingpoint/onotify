import { HTMLAttributes, useState } from "preact/compat";

interface DropdownProps extends HTMLAttributes<HTMLDivElement> {
	baseText: string;
	options?: {
		label: string;
		value: string;
	}[];
	onSelectOption?: (option: string) => void;
}

export default ({ options, baseText, onSelectOption, ...divProps }: DropdownProps) => {
	const [isOpen, setIsOpen] = useState(false);
	return (
		<div
			{...divProps}
			class={`rounded p-2 cursor-pointer bg-[var(--background-three)] relative ` + (divProps.class ?? "")}
			onClick={() => setIsOpen(!isOpen)}
			onMouseLeave={() => setIsOpen(false)}
			role="button"
			aria-haspopup="menu"
			aria-expanded={isOpen}
			tabIndex={0}
		>
			<span>{baseText}</span>
			{isOpen && options && (
				<div
					class="absolute mt-2 right-0 bg-[var(--background-three)] rounded shadow-lg z-10 whitespace-nowrap"
					role="menu"
					aria-label={`${baseText} options`}
				>
					{options.map((option) => (
						<div
							class="px-4 py-2 hover:bg-[var(--background-two)] cursor-pointer select-none"
							onClick={() => onSelectOption?.(option.value)}
							role="menuitem"
							tabIndex={0}
						>
							{option.label}
						</div>
					))}
				</div>
			)}
		</div>
	);
};
