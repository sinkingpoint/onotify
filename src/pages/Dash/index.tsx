import StatPanel from "../../components/StatPanel";

export const Dash = () => {
	return (
		<div class="w-full flex flex-col">
			<h1 class="text-4xl font-bold">Onotify</h1>
			<span class="flex flex-row justify-between w-full">
				<StatPanel title="Firing Alerts" value={1000000} class="w-1/3" />
				<StatPanel title="Silenced Alerts" value={1000000} class="w-1/3" />
				<StatPanel title="Silences" value={1000000} class="w-1/3" />
			</span>

			<h2 class="text-2xl font-bold mt-5">Latest Alerts</h2>
		</div>
	);
};
