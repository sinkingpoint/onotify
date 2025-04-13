import { HTMLAttributes } from "preact/compat";
import InfoBox from "../InfoBox";
import "./style.css";

interface StatPanelProps extends HTMLAttributes<HTMLDivElement> {
	title?: string;
	value?: number;
	error?: string;
}

export default ({ title, value, error, ...props }: StatPanelProps) => {
	const classes = "stat-panel flex flex-col flex-grow " + (props.class ?? "");
	const getContents = () => {
		if (error) {
			return <InfoBox style="error" text={error} />;
		}

		if (typeof value === "undefined") {
			return <span class="stat-panel-skeleton w-3/4 h-3/4 self-center" />;
		}

		return <span class="flex flex-row w-full justify-center text-8xl">{value}</span>;
	};

	return (
		<span class={classes}>
			{title && (
				<span class="flex flex-row w-full justify-start">
					<h1>{title}</h1>
				</span>
			)}
			{getContents()}
		</span>
	);
};
