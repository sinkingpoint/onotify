import "./style.css";

interface ToggleableChitProps {
	value: string;
	toggled: boolean;
	class?: string;
	onClick?: (toggled: boolean) => void;
}

export default ({ value, toggled, onClick, ...props }: ToggleableChitProps) => {
	let className = "cursor-pointer select-none rounded-xl px-3 py-1 toggleable-chit";
	if (!toggled) {
		className += " line-through decoration-2";
	}

	if (props.class) {
		className += ` ${props.class}`;
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
