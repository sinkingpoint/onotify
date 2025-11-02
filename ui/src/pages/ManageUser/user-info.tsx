import { SkeletonLoader } from "../../components/Skeleton";
import { getUser } from "../../pkg/api/client";
import { useQuery } from "../../pkg/types/utils";

export default () => {
	const userPull = useQuery(() => {
		return getUser({ path: { userID: "me" } });
	}, []);

	return (
		<div>
			<SkeletonLoader layout="paragraph" pull={userPull}>
				{userPull.state === "error" && <div>Error loading user info.</div>}
				{userPull.state === "success" && userPull.result && (
					<div class="space-y-4">
						<div>
							<h2 class="text-xl font-medium text-[color:var(--text-color)]">Name</h2>
							<p class="text-[color:var(--text-secondary-color)]">{userPull.result.user.name}</p>
						</div>
						<div>
							<h2 class="text-xl font-medium text-[color:var(--text-color)]">Email</h2>
							<p class="text-[color:var(--text-secondary-color)]">{userPull.result.user.email}</p>
						</div>
					</div>
				)}
			</SkeletonLoader>
		</div>
	);
};
