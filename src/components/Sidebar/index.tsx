import { BellAlertIcon, BellSlashIcon, HomeIcon } from "@heroicons/react/16/solid";
import { VNode } from "preact";
import { useLocation } from "preact-iso";
import { HTMLAttributes } from "preact/compat";
import "./style.css";

interface SideBarItemProps extends HTMLAttributes<HTMLDivElement> {
	title: string;
	href: string;
	icon?: VNode<any>;
}

const SideBarItem = ({ title, href, icon }: SideBarItemProps) => {
	const { url } = useLocation();
	let classes = "side-bar-item flex flex-row justify-start";
	if (url === href) {
		classes += " active";
	}

	return (
		<a class={classes} href={href}>
			<span class="pr-4">{icon}</span>
			<span>{title}</span>
		</a>
	);
};

export const SideBar = () => {
	return (
		<nav class="flex flex-col flex-grow rounded-r top-0 sticky side-bar">
			<div class="p-4">
				<h1 class="text-2xl font-bold p-4">Onotify</h1>
			</div>
			<SideBarItem title="Overview" href="/" icon={<HomeIcon class="inline size-6" />} />
			<SideBarItem title="Alerts" href="/alerts" icon={<BellAlertIcon class="inline size-6" />} />
			<SideBarItem title="Silences" href="/silences" icon={<BellSlashIcon class="inline size-6" />} />
		</nav>
	);
};
