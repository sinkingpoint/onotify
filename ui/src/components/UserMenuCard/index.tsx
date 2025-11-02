import { HTMLAttributes } from "preact/compat";
import { getUser } from "../../pkg/api/client";
import { useQuery } from "../../pkg/types/utils";
import { SkeletonLoader } from "../Skeleton";

interface UserMenuCardProps extends HTMLAttributes<HTMLAnchorElement> {
	href: string;
}

export default ({ href, ...extra }: UserMenuCardProps) => {
	const userPull = useQuery(() => getUser({ path: { userID: "me" } }), []);
	return (
		<a href={href} {...extra}>
			<SkeletonLoader pull={userPull} layout="single-line">
				{userPull.state === "success" && (
					<span>
						{userPull.result.user.name} ({userPull.result.user.email})
					</span>
				)}
			</SkeletonLoader>
		</a>
	);
};
