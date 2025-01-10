import { ButtonHTMLAttributes } from "preact/compat";
import "./index.css";

type ButtonColor = "success" | "warn" | "error";
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	icon?: SVGSVGElement;
	color: ButtonColor;
	text?: string;
}

export const Button = ({ icon, color, text, ...buttonProps }: ButtonProps) => {
	buttonProps.class ??= "";
	buttonProps.class += ` button button-${color}`;

	return (
		<button {...buttonProps}>
			{icon}
			{text}
		</button>
	);
};
