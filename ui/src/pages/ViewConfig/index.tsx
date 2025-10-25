import yaml from "js-yaml";
import { useMemo } from "preact/hooks";
import { getConfig } from "../../pkg/api/client";
import { useQuery } from "../../pkg/types/utils";

export default () => {
	const configPull = useQuery(() => getConfig(), []);
	const config = useMemo(() => {
		if (configPull.state === "success") {
			return yaml.dump(configPull.result);
		}

		return "";
	}, [configPull]);

	return (
		<div class="w-full flex flex-col">
			<h1>Config</h1>
			<textarea value={config} class="config-input grow mb-5 mr-5 p-3" disabled />
		</div>
	);
};
