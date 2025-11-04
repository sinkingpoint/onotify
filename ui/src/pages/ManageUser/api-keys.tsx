import { PlusCircleIcon } from "@heroicons/react/16/solid";
import { SkeletonLoader } from "../../components/Skeleton";
import { deleteApiKey, getUserTokens } from "../../pkg/api/client";
import { useQuery } from "../../pkg/types/utils";

export default () => {
	const apiKeys = useQuery(() => {
		return getUserTokens();
	}, []);

	const onDeleteKey = (keyId: string) => {
		deleteApiKey({ path: { tokenId: keyId } }).then(() => {
			apiKeys.state === "success" && apiKeys.refresh();
		});
	};

	return (
		<div class="flex flex-col">
			<a
				href="/user/api-keys/create"
				class="ml-auto p-2 bg-[color:var(--background-three)] text-white rounded flex flex-row"
			>
				<PlusCircleIcon class="inline size-5 m-0.5 mr-1" />
				Create
			</a>
			<SkeletonLoader layout="paragraph" pull={apiKeys}>
				{apiKeys.state === "error" && <div>Error loading API keys.</div>}
				{apiKeys.state === "success" && apiKeys.result.length === 0 && <div>No API keys found.</div>}
				{apiKeys.state === "success" && apiKeys.result.length > 0 && (
					<div class="overflow-hidden rounded-lg border-[color:var(--border-color)]">
						<table class="w-full">
							<thead>
								<tr>
									<th class="px-6 py-3 text-left font-medium uppercase tracking-wider text-[color:var(--text-color)]">
										Name
									</th>
									<th class="px-6 py-3 text-left font-medium uppercase tracking-wider text-[color:var(--text-color)]">
										Key
									</th>
									<th class="px-6 py-3 text-left font-medium uppercase tracking-wider text-[color:var(--text-color)]">
										Created At
									</th>
									<th class="px-6 py-3 text-left font-medium uppercase tracking-wider text-[color:var(--text-color)]">
										Scopes
									</th>
									<th class="px-6 py-3 text-left font-medium uppercase tracking-wider text-[color:var(--text-color)]">
										Actions
									</th>
								</tr>
							</thead>
							<tbody class="border-t-[color:var(--border-color)]">
								{apiKeys.result?.map((key, index) => (
									<tr key={key.id} class={`${index > 0 ? "border-t-[color:var(--border-color)]" : ""}`}>
										<td class="px-6 py-4 whitespace-nowrap font-medium text-[color:var(--text-color)]">{key.name}</td>
										<td class="px-6 py-4 whitespace-nowrap font-mono text-[color:var(--text-color)]">{key.id}</td>
										<td class="px-6 py-4 whitespace-nowrap text-[color:var(--text-color)]">
											{new Date(key.createdAt).toLocaleDateString()}
										</td>
										<td class="px-6 py-4 text-[color:var(--text-color)] max-w-48">
											<div class="flex flex-wrap gap-1">
												{key.scopes.map((scope) => (
													<span
														key={scope}
														class="inline-block px-2 py-1 text-xs bg-[color:var(--background-two)] text-[color:var(--text-two)] rounded-full"
													>
														{scope}
													</span>
												))}
											</div>
										</td>
										<td class="px-6 py-4 whitespace-nowrap text-[color:var(--text-color)]">
											<button class="text-red-500" onClick={() => onDeleteKey(key.id)}>
												Delete
											</button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</SkeletonLoader>
		</div>
	);
};
