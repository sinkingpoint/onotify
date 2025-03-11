import { HTMLAttributes, JSX } from "preact/compat";
import { DataPull } from "../../pkg/types/utils";
import "./style.css";

interface SkeletonLoaderProps<TSuccess, TError> extends HTMLAttributes<HTMLDivElement> {
	pull: DataPull<TSuccess, TError>;
	children: JSX.Element | JSX.Element[];
	layout: "single-line" | "paragraph";
	repeat?: number;
}

export const SkeletonLoader = <TSuccess, TError>({
	pull,
	children,
	layout,
	repeat,
	...props
}: SkeletonLoaderProps<TSuccess, TError>) => {
	const needsSkeleton = pull.state === "pending";
	if (!needsSkeleton) {
		return <>{children}</>;
	}

	const offsetAnimationMs = 50;
	const contents = [];
	for (let i = 0; i < (repeat ?? 1); i++) {
		if (layout === "single-line") {
			contents.push(
				<div class="skeleton w-full h-full" style={{ animationDelay: offsetAnimationMs * contents.length + "ms" }} />,
			);
		} else if (layout === "paragraph") {
			contents.push(
				<div class="skeleton w-full h-4" style={{ animationDelay: offsetAnimationMs * contents.length + "ms" }} />,
			);
			contents.push(
				<div class="skeleton w-1/2 h-4" style={{ animationDelay: offsetAnimationMs * contents.length + "ms" }} />,
			);
			contents.push(
				<div class="skeleton w-3/4 h-4" style={{ animationDelay: offsetAnimationMs * contents.length + "ms" }} />,
			);
		}
	}

	return (
		<div {...props} class={"skeleton-parent"}>
			{contents}
		</div>
	);
};
