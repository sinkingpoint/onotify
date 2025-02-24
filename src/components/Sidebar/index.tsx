import {
	BellAlertIcon,
	BellSlashIcon,
	ChevronDownIcon,
	ChevronUpIcon,
	DocumentTextIcon,
	HomeIcon,
} from "@heroicons/react/16/solid";
import { VNode } from "preact";
import { useLocation } from "preact-iso";
import { HTMLAttributes, useRef, useState } from "preact/compat";
import "./style.css";

interface SideBarItemProps extends HTMLAttributes<HTMLDivElement> {
	title: string;
	href: string;
	icon?: VNode<any>;
}

interface SideBarGroupProps {
	title: string;
	icon?: VNode<any>;
	initialExpanded: boolean;
	children?: SideBarItemElement | SideBarItemElement[];
}

const SideBarGroup = ({ title, icon, initialExpanded, children }: SideBarGroupProps) => {
	const [expanded, setExpanded] = useState(initialExpanded);
	const firstChildRef = useRef<SideBarItemElement>();
	const triggerGroupClick = () => {
		if (firstChildRef.current) {
			setExpanded(true);
			console.log((firstChildRef.current as any).base.click()); // Cast with any here. Base does exist, but I can't figure out how to type it.
		}
	};

	if (Array.isArray(children)) {
		if (children.length > 0) {
			children[0].ref = firstChildRef;
		}
	} else {
		children.ref = firstChildRef;
	}

	const toggleExpanded = (e: MouseEvent) => {
		e.stopPropagation();
		setExpanded(!expanded);
	};

	return (
		<span>
			<span class="flex flex-row justify-between side-bar-item" onClick={triggerGroupClick}>
				<span class="pr-4">{icon}</span>
				<span>{title}</span>
				<span class="flex-grow" />
				{expanded ? (
					<ChevronUpIcon class="inline size-6 ml-auto" onClick={toggleExpanded} />
				) : (
					<ChevronDownIcon class="inline size-6 ml-auto" onClick={toggleExpanded} />
				)}
			</span>

			<span class={expanded ? "" : "hidden"}>{children}</span>
		</span>
	);
};

const SideBarItem = ({ title, href, icon }: SideBarItemProps) => {
	const { url } = useLocation();
	let classes = "side-bar-item flex flex-row";
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

type SideBarItemElement = ReturnType<typeof SideBarItem>;

export const SideBar = () => {
	return (
		<nav class="flex flex-col flex-grow rounded-r top-0 sticky side-bar">
			<div class="p-4">
				<h1>Onotify</h1>
			</div>
			<SideBarItem title="Home" href="/" icon={<HomeIcon class="inline size-6" />} />
			<SideBarGroup title="Alerts" icon={<BellAlertIcon class="inline size-6" />} initialExpanded={true}>
				<SideBarItem title="Overview" href="/alerts" />
			</SideBarGroup>

			<SideBarGroup title="Silences" icon={<BellSlashIcon class="inline size-6" />} initialExpanded={true}>
				<SideBarItem title="Overview" href="/silences" />
				<SideBarItem title="New Silence" href="/silences/new" />
			</SideBarGroup>

			<SideBarGroup title="Config" icon={<DocumentTextIcon class="inline size-6" />} initialExpanded={true}>
				<SideBarItem title="Routing Tree" href="/config/tree" />
				<SideBarItem title="Receivers" href="/config/receivers" />
			</SideBarGroup>
		</nav>
	);
};
