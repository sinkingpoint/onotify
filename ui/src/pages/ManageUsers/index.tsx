import { PlusCircleIcon } from "@heroicons/react/16/solid";
import InfoBox from "../../components/InfoBox";
import { SkeletonLoader } from "../../components/Skeleton";
import { getAccountUsers } from "../../pkg/api/client";
import { useQuery } from "../../pkg/types/utils";

export default () => {
	const userPull = useQuery(() => getAccountUsers(), []);
	return (
		<div class="w-full flex flex-col">
			<h1>Manage Users</h1>
			<a
				href="/account/users/invite"
				class="ml-auto mb-4 p-2 bg-[color:var(--background-three)] text-white rounded flex flex-row"
			>
				<PlusCircleIcon class="inline size-5 m-0.5 mr-1" />
				Invite User
			</a>
			<SkeletonLoader layout="paragraph" pull={userPull}>
				{userPull.state === "error" && <InfoBox style="error" text="Error loading users." />}
				{userPull.state === "success" && userPull.result.length === 0 && <div>No users found.</div>}
				{userPull.state === "success" && userPull.result.length > 0 && (
					<div class="overflow-hidden rounded-lg border-[color:var(--border-color)] mt-6">
						<table class="w-full">
							<thead>
								<tr>
									<th class="px-6 py-3 text-left font-medium uppercase tracking-wider text-[color:var(--text-color)]">
										Name
									</th>
									<th class="px-6 py-3 text-left font-medium uppercase tracking-wider text-[color:var(--text-color)]">
										Email
									</th>
									<th class="px-6 py-3 text-left font-medium uppercase tracking-wider text-[color:var(--text-color)]">
										Scopes
									</th>
								</tr>
							</thead>
							<tbody class="border-t-[color:var(--border-color)]">
								{userPull.result.map((user, index) => (
									<tr key={user.id} class={`${index > 0 ? "border-t-[color:var(--border-color)]" : ""}`}>
										<td class="px-6 py-4 whitespace-nowrap font-medium text-[color:var(--text-color)]">{user.name}</td>
										<td class="px-6 py-4 whitespace-nowrap text-[color:var(--text-color)]">{user.email}</td>
										<td class="px-6 py-4 text-[color:var(--text-color)] max-w-48">
											<div class="flex flex-wrap gap-1">
												{user.scopes.map((scope) => (
													<span
														key={scope}
														class="inline-block px-2 py-1 text-xs bg-[color:var(--background-two)] text-[color:var(--text-two)] rounded-full"
													>
														{scope}
													</span>
												))}
											</div>
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
