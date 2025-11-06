import { ChevronRightIcon } from "@heroicons/react/16/solid";
import { HTMLAttributes } from "preact/compat";
import { useMemo, useState } from "preact/hooks";
import Paginator from "../../components/Paginator";
import { TextBox } from "../../components/TextBox";
import { getConfig, GetConfigResponse } from "../../pkg/api/client";
import { useQuery } from "../../pkg/types/utils";

interface ReceiverCardProps extends HTMLAttributes<HTMLAnchorElement> {
	receiver: GetConfigResponse["receivers"][number];
}

const ReceiverCard = ({ receiver, ...props }: ReceiverCardProps) => {
	const counts = {};
	for (const key in receiver) {
		if (key.includes("_configs")) {
			const name = key.slice(0, 1).toUpperCase() + key.replace("_configs", "").replace("_", " ").slice(1);

			const configArray = receiver[key as keyof typeof receiver];
			if (Array.isArray(configArray)) {
				counts[name] = configArray.length;
			}
		}
	}

	return (
		<a href={`/receivers/${receiver.name}`} class="flex flex-row alert-card justify-between p-3" {...props}>
			<div class="flex flex-col flex-1 min-w-0">
				<span>
					<label class="inline font-bold">Receiver Name: </label>
					<span>{receiver.name}</span>
				</span>

				<span class="mt-2">
					<label class="inline font-bold">Configurations:</label>
					<div class="mt-1 grid grid-cols-2 gap-2">
						{Object.entries(counts).map(([key, count]) => (
							<span key={key} class="text-sm">
								{count} {key} Config{count !== 1 ? "s" : ""}
							</span>
						))}
					</div>
				</span>
			</div>

			<ChevronRightIcon class="inline size-10 self-center alert-card-view-btn" />
		</a>
	);
};

export default () => {
	const configPull = useQuery(() => getConfig(), []);
	const [searchQuery, setSearchQuery] = useState("");
	const receivers = useMemo(() => {
		if (configPull.state !== "success") {
			return [];
		}

		return configPull.result.receivers.filter((receiver) =>
			receiver.name.toLowerCase().includes(searchQuery.toLowerCase()),
		);
	}, [configPull, searchQuery]);

	const [currentPage, setCurrentPage] = useState(1);
	const itemsPerPage = 10;

	const start = (currentPage - 1) * itemsPerPage;
	const end = start + itemsPerPage;
	const totalPages = Math.max(Math.ceil(receivers.length / itemsPerPage), 1);

	return (
		<div class="w-full flex flex-col">
			<h1>Receivers</h1>

			<div class="mt-4 mb-4">
				<TextBox
					placeholder="Search receivers..."
					value={searchQuery}
					onInput={(e) => {
						setSearchQuery((e.target as HTMLInputElement).value);
						setCurrentPage(1); // Reset to first page when searching
					}}
				/>
			</div>

			<div class="mt-4 space-y-4">
				<Paginator currentPage={currentPage} totalPages={totalPages} setCurrentPage={setCurrentPage}>
					{receivers.slice(start, end).map((receiver) => (
						<ReceiverCard key={receiver.name} receiver={receiver} />
					))}
				</Paginator>
			</div>
		</div>
	);
};
