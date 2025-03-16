import InfoBox from "../../components/InfoBox";
import { MatcherCard } from "../../components/MatcherCard";
import { getRoutingTree } from "../../pkg/api/client";
import { FlatRouteConfig, FlatRouteConfigSpec } from "../../pkg/types/alertmanager";
import { useQuery } from "../../pkg/types/utils";

type ChildFunc<T> = (t: T) => string[];

class DAG<T> {
	private roots: string[];
	private nodes: Record<string, T>;
	private children: ChildFunc<T>;
	constructor(nodes: Record<string, T>, roots: string[], children?: ChildFunc<T>) {
		this.children =
			children ??
			((t: T) => {
				return (t as any).children;
			});

		this.nodes = nodes;
		this.roots = roots;
	}

	getChildren(nodeID: string): string[] {
		return this.children(this.nodes[nodeID]);
	}

	layout(width: number, height: number, nodeWidth: number, nodeHeight: number) {
		const toParse = this.roots.map((r) => [r, 0] as [string, number]);
		const nodesAtDepth = [];
		const nodePositions: Record<string, [number, number]> = {};
		while (toParse.length > 0) {
			const [nodeID, depth] = toParse.pop();
			while (nodesAtDepth.length <= depth) {
				nodesAtDepth.push([]);
			}

			nodesAtDepth[depth].push(nodeID);
			for (const childID of this.children(this.nodes[nodeID])) {
				toParse.push([childID, depth + 1]);
			}
		}

		const xGapSize =
			nodesAtDepth.length > 1 ? (width - nodesAtDepth.length * nodeWidth) / (nodesAtDepth.length - 1) : 0;
		for (let depth = 0; depth < nodesAtDepth.length; depth++) {
			const numElements = nodesAtDepth[depth].length;
			const yGapSize = numElements > 1 ? (height - nodeHeight * numElements) / numElements - 1 : 0;
			const totalHeight = numElements * nodeHeight + (numElements - 1) * yGapSize;
			const startY = (height - totalHeight) / 2;
			const startX = 0;
			for (let i = 0; i < nodesAtDepth[depth].length; i++) {
				const x = startX + depth * (nodeWidth + xGapSize);
				const y = startY + i * (nodeHeight + yGapSize);
				nodePositions[nodesAtDepth[depth][i]] = [x, y];
			}
		}

		return nodePositions;
	}
}

const getSCurve = ([startX, startY]: [number, number], [endX, endY]: [number, number]) => {
	const dx = endX - startX;
	const dy = endY - startY;

	const x1 = startX + dx / 3;
	const y1 = startY;

	const x3 = startX + (2 * dx) / 3;
	const y3 = endY;

	return `M${startX},${startY} C${x1},${y1}, ${x1},${y1}, ${startX + dx / 2},${startY + dy / 2} C${x3},${y3}, ${x3},${y3}, ${endX},${endY}`;
};

const getMatcherCards = (node: FlatRouteConfig) => {
	const cards = [];
	for (const key of Object.keys(node.match)) {
		cards.push(<MatcherCard matcher={{ name: key, value: node.match[key], isEqual: true, isRegex: false }} />);
	}

	for (const key of Object.keys(node.match_re)) {
		cards.push(<MatcherCard matcher={{ name: key, value: node.match_re[key], isEqual: true, isRegex: true }} />);
	}

	for (const matcher of node.matchers) {
		cards.push(<MatcherCard matcher={matcher} />);
	}

	if (cards.length === 0) {
		return <InfoBox style="warn" text="No Matchers" class="m-4" />;
	}

	return cards;
};

export default () => {
	const treePull = useQuery(() => getRoutingTree(), []);

	const MAX_HEIGHT = 500;
	const MAX_WIDTH = 1000;
	const NODE_WIDTH = 300;
	const NODE_HEIGHT = 100;

	const nodes = [];
	if (treePull.state === "success") {
		const tree = new DAG(treePull.result.tree, treePull.result.roots, (c) => c.routes);
		const positions = tree.layout(MAX_WIDTH, MAX_HEIGHT, NODE_WIDTH, NODE_HEIGHT);
		for (const nodeID of Object.keys(positions)) {
			const [x, y] = positions[nodeID];
			nodes.push(
				<g>
					<rect x={x} y={y} width={NODE_WIDTH} height={NODE_HEIGHT} class="fill-[var(--background-three)]" />
					<foreignObject x={x + 15} y={y + 15} width={NODE_WIDTH} height={NODE_HEIGHT}>
						{getMatcherCards(
							FlatRouteConfigSpec.parse(treePull.result.tree[nodeID]) as Omit<FlatRouteConfig, "routes"> & {
								routes: string[];
							},
						)}
					</foreignObject>
				</g>,
			);
			for (const childID of tree.getChildren(nodeID)) {
				const [childX, childY] = positions[childID];

				nodes.push(
					<path
						d={getSCurve([x + NODE_WIDTH, y + NODE_HEIGHT / 2], [childX, childY + NODE_HEIGHT / 2])}
						class="stroke-[var(--background-two)]"
						fill="none"
						stroke-width={2}
					/>,
				);
			}
		}
	}

	return (
		<span class="w-full h-full">
			<svg width={MAX_WIDTH.toString()} height={MAX_HEIGHT.toString()} xmlns="http://www.w3.org/2000/svg">
				{nodes}
			</svg>
		</span>
	);
};
