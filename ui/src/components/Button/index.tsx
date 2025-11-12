import { VNode } from "preact";
import { ButtonHTMLAttributes } from "preact/compat";
import "./index.css";

type ButtonColor = "success" | "warn" | "error";
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	icon?: VNode<any>;
	color: ButtonColor;
	text?: string;
}

export const Button = ({ icon, color, text, ...buttonProps }: ButtonProps) => {
	buttonProps.class ??= "";
	buttonProps.class += ` flex flex-row button button-${color} items-center px-4 py-2 rounded-md font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed`;

	return (
		<button {...buttonProps}>
			{icon}
			{text}
		</button>
	);
};
