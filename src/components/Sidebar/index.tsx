import {
	Bars3BottomLeftIcon,
	BellAlertIcon,
	BellSlashIcon,
	ChevronUpIcon,
	DocumentTextIcon,
	HomeIcon,
} from "@heroicons/react/16/solid";
import { VNode } from "preact";
import { useLocation } from "preact-iso";
import { HTMLAttributes, useRef, useState } from "preact/compat";
import "./style.css";

interface SideBarItemProps extends HTMLAttributes<HTMLAnchorElement> {
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
	const containsActiveChild = Array.isArray(children)
		? children.some((child) => child.props.href === useLocation().url)
		: children.props.href === useLocation().url;

	const triggerGroupClick = () => {
		if (firstChildRef.current) {
			setExpanded(true);
			(firstChildRef.current as any).base.click(); // Cast with any here. Base does exist, but I can't figure out how to type it.
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
		// Disable toggling if a child is active, so we don't hide the active button.
		if (containsActiveChild) {
			e.preventDefault();
			return;
		}

		e.stopPropagation();
		setExpanded(!expanded);
	};

	const chevronClasses =
		"inline size-6 ml-auto" + (!expanded ? " rotate-180" : "") + (containsActiveChild ? " fill-[#999999]" : "");

	return (
		<span>
			<span class="flex flex-row justify-between side-bar-item side-bar-group" onClick={triggerGroupClick}>
				<span class="pr-4">{icon}</span>
				<span>{title}</span>
				<span class="flex-grow" />
				<span class="side-bar-chevron py-3" onClick={toggleExpanded}>
					<ChevronUpIcon class={chevronClasses} />
				</span>
			</span>

			<span class={expanded ? "" : "hidden"}>{children}</span>
		</span>
	);
};

const SideBarItem = ({ title, href, icon, ...props }: SideBarItemProps) => {
	const { url } = useLocation();
	let classes = "side-bar-item py-3 flex flex-row w-full";
	if (url === href) {
		classes += " active";
	}

	return (
		<a {...props} class={classes + (!icon ? " pl-[3.75rem]" : "")} href={href}>
			{icon && <span class="pr-4">{icon}</span>}
			<span>{title}</span>
		</a>
	);
};

type SideBarItemElement = ReturnType<typeof SideBarItem>;

export const SideBar = () => {
	const MIN_WIDTH_FOR_DEFAULT_OPEN = 800;

	const [state, setState] = useState<"open" | "closed">(
		typeof window !== "undefined" && window.innerWidth < MIN_WIDTH_FOR_DEFAULT_OPEN ? "closed" : "open",
	);

	if (state === "open") {
		return (
			<nav class="flex flex-col rounded-r top-0 sticky side-bar w-64">
				<div class="p-4 flex flex-row justify-between">
					<h1>Onotify</h1>
					<span class="side-bar-chevron flex flex-col justify-center" onClick={() => setState("closed")}>
						<ChevronUpIcon class="inline size-6 ml-auto -rotate-90" />
					</span>
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
					<SideBarItem title="Receivers" href="/config/receivers" />
				</SideBarGroup>
			</nav>
		);
	} else {
		return (
			<nav class="flex flex-col rounded-r top-0 sticky side-bar w-16">
				<span class="my-5 py-2 self-center side-bar-chevron">
					<Bars3BottomLeftIcon class="inline size-10" onClick={() => setState("open")} />
				</span>
			</nav>
		);
	}
};
