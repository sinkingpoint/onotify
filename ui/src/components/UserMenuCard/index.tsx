import { HTMLAttributes } from "preact/compat";
import { getUser } from "../../pkg/api/client";
import { useQuery } from "../../pkg/types/utils";
import { SkeletonLoader } from "../Skeleton";

interface UserMenuCardProps extends HTMLAttributes<HTMLDivElement> {}
export default (props: UserMenuCardProps) => {
	const userPull = useQuery(() => getUser({ path: { userID: "me" } }), []);
	return (
		<div {...props}>
			<SkeletonLoader pull={userPull} layout="single-line">
				{userPull.state === "success" && (
					<span>
						{userPull.result.user.name} ({userPull.result.user.email})
					</span>
				)}
			</SkeletonLoader>
		</div>
	);
};
