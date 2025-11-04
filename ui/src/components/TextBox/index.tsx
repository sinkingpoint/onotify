import { InputHTMLAttributes, JSX, Ref } from "preact/compat";
import "./index.css";

interface TextBoxProps extends InputHTMLAttributes<HTMLInputElement> {
	valid?: boolean;
	textRef?: Ref<HTMLInputElement>;
	button?: JSX.Element;
	placeholder?: string;
	onButtonClick?: () => void;
}

export const TextBox = ({ valid, button, onButtonClick, textRef, placeholder, ...inputProps }: TextBoxProps) => {
	inputProps.class ??= "";
	inputProps.class += " bg-transparent txt-box";

	if (!(valid ?? true)) {
		inputProps.class += " txt-box-invalid";
	}

	const input = <input type="text" {...inputProps} ref={textRef} placeholder={placeholder} />;
	if (!button) {
		input.props.class += " border-solid border-2 rounded txt-box-container";
		return input;
	}

	let containerClasses = "border-solid border-2 rounded txt-box-container flex flex-row";
	if (!(valid ?? true)) {
		containerClasses += " txt-box-invalid";
	}

	return (
		<span class={containerClasses}>
			{input}
			<span
				class="flex items-center justify-center"
				onMouseDown={(e: MouseEvent) => {
					e.preventDefault();
				}}
				onClick={() => {
					if (onButtonClick) {
						onButtonClick();
					}
				}}
			>
				{button}
			</span>
		</span>
	);
};
