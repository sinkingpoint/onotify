import { useMemo, useState } from "preact/hooks";
import { Button } from "../../components/Button";
import DurationInput from "../../components/DurationInput";
import FilterInput from "../../components/FilterInput";
import { TextBox } from "../../components/TextBox";
import { StringMatcherSpec } from "../../pkg/types/alertmanager";
import { Matcher } from "../../pkg/types/api";
import { matcherToString, setURLParam } from "../../pkg/types/utils";
import { getURLSearchParams } from "../../pkg/utils/preact-shims";
import { PreviewProps } from "./preview";
import { formatDate, getSilenceEnd } from "./utils";

const matcherIsSame = (a: Matcher, b: Matcher) => {
	return a.isEqual === b.isEqual && a.isRegex === b.isRegex && a.name === b.name && a.value === b.value;
};

interface CreateSilenceProps {
	onPreview(p: PreviewProps): void;
}

export const CreateSilence = ({ onPreview }: CreateSilenceProps) => {
	const params = getURLSearchParams();
	const [matchers, setMatchers] = useState<Matcher[]>(params.getAll("matcher").map((m) => StringMatcherSpec.parse(m)));

	const [duration, setDuration] = useState<string>(params.get("duration") ?? "1h");
	const [comment, setComment] = useState<string>(params.get("comment") ?? "");

	const handleSetDuration = (newDuration: string) => {
		setDuration(newDuration);
		if (getSilenceEnd(newDuration)) {
			setURLParam("duration", newDuration);
		}
	};

	const setMatchersInURLParams = (matchers: Matcher[]) => {
		setURLParam(
			"matcher",
			matchers.map((m) => matcherToString(m)),
		);

		setMatchers(matchers);
	};

	const handleNewMatcher = (matcher: Matcher) => {
		if (!matchers.some((m) => matcherIsSame(matcher, m))) {
			setMatchersInURLParams([...matchers, matcher]);
		}
	};

	const removeMatcher = (matcher: Matcher) => {
		const idx = matchers.findIndex((m) => matcherIsSame(matcher, m));
		if (idx !== -1) {
			matchers.splice(idx, 1);
			setMatchersInURLParams([...matchers]);
		}
	};

	const checkFormValidity = () => {
		const comment = document.getElementById("comment") as HTMLInputElement;
		const matcher = document.getElementById("matcher") as HTMLInputElement;

		if (comment.value === "") {
			comment.setCustomValidity("Comment cannot be empty");
			comment.reportValidity();
			return false;
		}

		if (matchers.length === 0) {
			matcher.setCustomValidity("Missing at least one matcher");
			matcher.reportValidity();
			return false;
		}

		return true;
	};

	const end = useMemo(() => {
		const endDate = getSilenceEnd(duration);
		return endDate !== null ? <>Ends {formatDate(endDate)}</> : <>Invalid duration</>;
	}, [duration]);

	return (
		<>
			<h2 class="text-xl mb-1 mt-0">Duration</h2>
			<div class="flex flex-col md:flex-row flex-wrap mb-2">
				<DurationInput onChange={(d) => handleSetDuration(d)} duration={duration} />

				<span class="sm:ml-0 sm:mt-5 md:mt-0 md:ml-5">{end}</span>
			</div>

			<h2 class="text-xl mb-1 mt-0">Matchers</h2>
			<FilterInput matchers={matchers} handleNewMatcher={handleNewMatcher} removeMatcher={removeMatcher} />

			<h2 class="text-xl mb-1 mt-0">Comment</h2>
			<TextBox
				id="comment"
				type="text"
				title="A comment explaining this silence"
				value={comment}
				onInput={(e) => {
					setComment(e.currentTarget.value);
					setURLParam("comment", e.currentTarget.value);
				}}
			/>

			<span>
				<Button
					text="Preview"
					color="warn"
					class="font-bold p-2 rounded mt-4"
					onClick={() =>
						checkFormValidity() &&
						onPreview({
							duration,
							comment,
							matchers,
						})
					}
				/>
			</span>
		</>
	);
};
