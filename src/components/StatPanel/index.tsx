import "./style.css";

interface StatPanelProps extends React.HTMLAttributes<HTMLDivElement> {
	title?: string;
	value: number;
}

export default ({ title, value, ...props }: StatPanelProps) => {
	const classes = "stat-panel flex flex-col " + (props.class ?? "");
	return (
		<div class={classes}>
			{title ? (
				<span class="flex flex-row w-full justify-start">
					<h1>{title}</h1>
				</span>
			) : (
				<></>
			)}
			<span class="flex flex-row w-full justify-center text-8xl">{value}</span>
		</div>
	);
};
