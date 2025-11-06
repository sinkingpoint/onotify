import { JSX } from "preact";
import { useState } from "preact/hooks";
import "./styles.css";

type TabProps = {
	name: string;
	children: preact.ComponentChildren;
};

export function Tab({ children }: TabProps) {
	return <>{children}</>;
}

type TabPaneProps = {
	children: preact.ComponentChildren;
	initialIndex?: number;
};

export function TabPane({
	children,
	initialIndex = 0,
	...divProps
}: TabPaneProps & JSX.HTMLAttributes<HTMLDivElement>) {
	const tabs = Array.isArray(children) ? children : [children];
	const tabList = tabs
		.filter((tab: any) => tab && tab.props && tab.props.name)
		.map((tab: any) => ({
			name: tab.props.name,
			content: tab.props.children,
		}));

	if (window.location.hash && window.location.hash.startsWith("#tab-")) {
		const tabIndex = parseInt(window.location.hash.replace("#tab-", ""), 10);
		if (!isNaN(tabIndex) && tabIndex < tabList.length) {
			initialIndex = tabIndex;
		}
	}

	const [selected, setSelected] = useState(initialIndex);

	const onTabChange = (index: number) => {
		setSelected(index);
		window.location.hash = `#tab-${index}`;
	};

	return (
		<div {...divProps}>
			<div style={{ display: "flex", borderBottom: "1px solid #ccc" }}>
				{tabList.map((tab, idx) => (
					<button
						key={tab.name}
						onClick={() => onTabChange(idx)}
						className={"tab-pane-header " + (selected === idx ? " active" : "")}
					>
						{tab.name}
					</button>
				))}
			</div>
			<div style={{ padding: "16px" }}>{tabList[selected]?.content}</div>
		</div>
	);
}

export const VerticalTabPane = ({
	children,
	initialIndex = 0,
	...divProps
}: TabPaneProps & JSX.HTMLAttributes<HTMLDivElement>) => {
	const tabs = Array.isArray(children) ? children : [children];
	const tabList = tabs
		.filter((tab: any) => tab && tab.props && tab.props.name)
		.map((tab: any) => ({
			name: tab.props.name,
			content: tab.props.children,
		}));

	const [selected, setSelected] = useState(initialIndex);

	return (
		<div {...divProps} style={{ display: "flex" }}>
			<div style={{ display: "flex", flexDirection: "column", borderRight: "1px solid #ccc" }}>
				{tabList.map((tab, idx) => (
					<button
						key={tab.name}
						onClick={() => setSelected(idx)}
						className={"tab-pane-header " + (selected === idx ? " active" : "")}
					>
						{tab.name}
					</button>
				))}
			</div>
			<div style={{ padding: "16px", flex: 1 }}>{tabList[selected]?.content}</div>
		</div>
	);
};
