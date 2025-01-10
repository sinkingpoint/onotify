import { XMarkIcon } from "@heroicons/react/16/solid";
import { InputHTMLAttributes } from "preact/compat";
import { Matcher } from "../../pkg/types/api";
import "./index.css";

const matcherToString = (matcher: Matcher) => {
	let comparison = "";
	if (matcher.isEqual) {
		if (matcher.isRegex) {
			comparison = "=~";
		} else {
			comparison = "=";
		}
	} else {
		if (matcher.isRegex) {
			comparison = "!~";
		} else {
			comparison = "!=";
		}
	}

	return `${matcher.name}${comparison}"${matcher.value}"`;
};

interface TextBoxProps extends InputHTMLAttributes<HTMLSpanElement> {
	matcher: Matcher;
	onDelete?: () => void;
}

export const MatcherCard = ({ onDelete, matcher, ...props }: TextBoxProps) => {
	props.class ??= "";
	props.class += " bg-transparent matcher-card";

	const input = <span {...props}>{matcherToString(matcher)}</span>;
	if (!onDelete) {
		input.props.class += " border-solid border-2 rounded matcher-card-container";
		return input;
	}

	return (
		<span class="border-solid border-2 rounded matcher-card-container flex flex-row mr-2">
			{input}
			<span
				class="flex items-center justify-center"
				onClick={() => {
					onDelete();
				}}
			>
				<XMarkIcon class="inline size-5" />
			</span>
		</span>
	);
};
