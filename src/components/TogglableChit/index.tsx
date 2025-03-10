interface ToggleableChitProps {
	value: string;
	toggled: boolean;
	onClick?: (toggled: boolean) => void;
}

export default ({ value, toggled, onClick }: ToggleableChitProps) => {
	let className = "cursor-pointer select-none rounded-xl px-3 py-1";
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
