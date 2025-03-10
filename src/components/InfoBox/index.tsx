import { HTMLAttributes } from "preact/compat";
import "./style.css";

interface InfoBoxProps extends HTMLAttributes<HTMLSpanElement> {
	style: "info" | "warn" | "error";
	text: string;
}

export default ({ style, text, ...props }: InfoBoxProps) => {
	const cls = `p-2 rounded-md bg-slate100 info-box-${style} ` + (props.class ? props.class : "");
	return (
		<span {...props} class={cls}>
			{text}
		</span>
	);
};
