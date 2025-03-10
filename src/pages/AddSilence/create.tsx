import { ChangeEvent } from "preact/compat";
import { useMemo, useState } from "preact/hooks";
import { Button } from "../../components/Button";
import FilterInput from "../../components/FilterInput";
import { TextBox } from "../../components/TextBox";
import { StringMatcherSpec } from "../../pkg/types/alertmanager";
import { Matcher } from "../../pkg/types/api";
import { matcherToString } from "../../pkg/types/utils";
import { PreviewProps } from "./preview";
import { formatDate, getSilenceEnd } from "./utils";

const matcherIsSame = (a: Matcher, b: Matcher) => {
	return a.isEqual === b.isEqual && a.isRegex === b.isRegex && a.name === b.name && a.value === b.value;
};

const setURLParam = <T,>(paramName: string, values: T | T[]) => {
	const url = new URL(window.location.toString());
	const params = new URLSearchParams(url.search);
	if (Array.isArray(values)) {
		params.delete(paramName);
		values.forEach((m) => params.append(paramName, m.toString()));
	} else {
		params.set(paramName, values.toString());
	}

	url.search = params.toString();
	history.replaceState({}, "", url.toString());
};

interface CreateSilenceProps {
	onPreview(p: PreviewProps): void;
}

export const CreateSilence = ({ onPreview }: CreateSilenceProps) => {
	const params = new URLSearchParams(window.location.search);
	const [matchers, setMatchers] = useState<Matcher[]>(params.getAll("matcher").map((m) => StringMatcherSpec.parse(m)));

	const [duration, setDuration] = useState<string>(params.get("duration") ?? "1h");
	const [comment, setComment] = useState<string>(params.get("comment") ?? "");

	const handleSetDuration = (e: ChangeEvent<HTMLInputElement>) => {
		const newRawDuration = e.currentTarget.value;
		setDuration(newRawDuration);
		if (getSilenceEnd(newRawDuration)) {
			setURLParam("duration", newRawDuration);
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
		const duration = document.getElementById("duration") as HTMLInputElement;
		const comment = document.getElementById("comment") as HTMLInputElement;

		if (getSilenceEnd(duration.value) === null) {
			duration.setCustomValidity("Invalid duration");
			duration.reportValidity();
			return false;
		} else if (comment.value === "") {
			comment.setCustomValidity("Comment cannot be empty");
			comment.reportValidity();
			return false;
		}

		return true;
	};

	const isDurationValid = useMemo(() => {
		return getSilenceEnd(duration) !== null;
	}, [duration]);

	const end = useMemo(() => {
		const endDate = getSilenceEnd(duration);
		return endDate !== null ? <span>Ends {formatDate(endDate)}</span> : <span>Invalid duration</span>;
	}, [duration]);

	return (
		<>
			<h2 class="text-xl">Duration</h2>
			<div class="flex justify-start flex-wrap items-center">
				<TextBox
					id="duration"
					class="mb-2"
					title="Duration in Go format, e.g. 1h"
					pattern="[0-9]+[mhdw]"
					value={duration}
					onInput={handleSetDuration}
					valid={isDurationValid}
				/>

				<span class="pl-10">{end}</span>
			</div>

			<h2 class="text-xl">Matchers</h2>
			<FilterInput matchers={matchers} handleNewMatcher={handleNewMatcher} removeMatcher={removeMatcher} />

			<h2 class="text-xl">Comment</h2>
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
