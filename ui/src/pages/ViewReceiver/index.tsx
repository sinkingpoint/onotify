import { useRoute } from "preact-iso";
import { useMemo } from "preact/hooks";
import { Tab, VerticalTabPane } from "../../components/TabPane";
import { getConfig } from "../../pkg/api/client";
import { useQuery } from "../../pkg/types/utils";

export default () => {
	const location = useRoute();
	const name = location.params["name"];
	const configPull = useQuery(() => getConfig(), []);
	const receiver = useMemo(() => {
		if (configPull.state !== "success") {
			return null;
		}

		return configPull.result.receivers.find((r) => r.name === name);
	}, [configPull, name]);

	const tabs = useMemo(() => {
		if (!receiver) {
			return [];
		}

		const tabList = [];
		for (const key in receiver) {
			if (key.includes("_configs")) {
				const name = key.slice(0, 1).toUpperCase() + key.replace("_configs", "").replace("_", " ").slice(1);
				tabList.push(name);
			}
		}
		return tabList;
	}, [receiver]);

	return (
		<div class="w-full flex flex-col">
			<div class="flex items-center justify-between mb-4">
				<h1>{name}</h1>
			</div>
			<VerticalTabPane>
				{tabs.map((tab) => (
					<Tab key={tab} name={tab}>
						<div class="mt-4">
							<pre>
								{JSON.stringify(
									receiver?.[`${tab.toLowerCase().replace(" ", "_")}_configs` as keyof typeof receiver],
									null,
									2,
								)}
							</pre>
						</div>
					</Tab>
				))}
			</VerticalTabPane>
		</div>
	);
};
