import { PlusIcon } from "@heroicons/react/16/solid";
import { HTMLAttributes, useRef } from "preact/compat";
import { StringMatcherSpec } from "../../pkg/types/alertmanager";
import { Matcher } from "../../pkg/types/api";
import { MatcherCard } from "../MatcherCard";
import { TextBox } from "../TextBox";

interface FilterInputProps extends HTMLAttributes<HTMLInputElement> {
	matchers: Matcher[];
	handleNewMatcher: (matcher: Matcher) => void;
	removeMatcher: (matcher: Matcher) => void;
}

export default ({ matchers, handleNewMatcher, removeMatcher }: FilterInputProps) => {
	const matchersInputRef = useRef<HTMLInputElement>();
	const matcherCards = matchers.map((m) => <MatcherCard matcher={m} onDelete={() => removeMatcher(m)} />);

	const matcherFromInput = () => {
		try {
			const matcher = StringMatcherSpec.parse(matchersInputRef.current.value);
			matchersInputRef.current.value = "";
			matchersInputRef.current.setCustomValidity("");
			matchersInputRef.current.blur();
			matchersInputRef.current.focus(); // hack for clearing a failed validation.
			handleNewMatcher(matcher);
		} catch {
			matchersInputRef.current.setCustomValidity("Invalid matcher");
			matchersInputRef.current.reportValidity();
		}
	};

	return (
		<>
			<div class="flex flex-row">
				<TextBox
					id="matcher"
					textRef={matchersInputRef}
					type="text"
					placeholder={`a="b"`}
					title='Matchers that this silence will match, e.g. label="value"'
					onKeyPress={(e) => {
						if (e.key === "Enter") {
							matcherFromInput();
						}
					}}
					button={<PlusIcon class="inline size-5" />}
					onButtonClick={() => matcherFromInput()}
				/>
			</div>

			<div class="flex flex-row flex-wrap flex-shrink flex-grow-0 pt-2">{matcherCards}</div>
		</>
	);
};
