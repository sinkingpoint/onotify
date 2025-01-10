import { PlusIcon } from "@heroicons/react/16/solid";
import { useLocation } from "preact-iso";
import { ChangeEvent } from "preact/compat";
import { useMemo, useRef, useState } from "preact/hooks";
import { Button } from "../../components/Button";
import { MatcherCard } from "../../components/MatcherCard";
import { TextBox } from "../../components/TextBox";
import { StringMatcherSpec } from "../../pkg/types/alertmanager";
import { Matcher } from "../../pkg/types/api";
import { DurationSpec } from "../../pkg/types/duration";

const formatDate = (d: Date): string => {
	return d.toLocaleString([], {
		day: "numeric",
		month: "short",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
};

const getSilenceEnd = (duration: string) => {
	try {
		const millis = DurationSpec.parse(duration);
		return new Date(Date.now() + millis);
	} catch {
		return null;
	}
};

const matcherIsSame = (a: Matcher, b: Matcher) => {
	return a.isEqual === b.isEqual && a.isRegex === b.isRegex && a.name === b.name && a.value === b.value;
};

export const AddSilence = () => {
	const location = useLocation();
	const matchersInputRef = useRef<HTMLInputElement>();

	const [duration, setDuration] = useState<string>(location.query["duration"] ?? "1h");
	const [matchers, setMatchers] = useState<Matcher[]>([]);

	const handleSetDuration = (e: ChangeEvent<HTMLInputElement>) => {
		setDuration(e.currentTarget.value);
	};

	const handleNewMatcher = () => {
		try {
			const matcher = StringMatcherSpec.parse(matchersInputRef.current.value);
			if (!matchers.some((m) => matcherIsSame(matcher, m))) {
				setMatchers([...matchers, matcher]);
			}

			matchersInputRef.current.blur();
			matchersInputRef.current.focus(); // hack for clearing a failed validation.
			matchersInputRef.current.value = "";
			return true;
		} catch {
			matchersInputRef.current.setCustomValidity("Invalid Matcher");
			matchersInputRef.current.reportValidity();
			return false;
		}
	};

	const removeMatcher = (matcher: Matcher) => {
		const idx = matchers.findIndex((m) => matcherIsSame(matcher, m));
		if (idx !== -1) {
			matchers.splice(idx, 1);
			setMatchers([...matchers]);
		}
	};

	const checkFormValidity = () => {
		const duration = document.getElementById("duration") as HTMLInputElement;
		const comment = document.getElementById("comment") as HTMLInputElement;

		if (getSilenceEnd(duration.value) === null) {
			duration.setCustomValidity("Invalid duration");
			duration.reportValidity();
		} else if (comment.value === "") {
			comment.setCustomValidity("Comment cannot be empty");
			comment.reportValidity();
		}

		return true;
	};

	const isDurationValid = useMemo(() => {
		return getSilenceEnd(duration) !== null;
	}, [duration]);

	const end = useMemo(() => {
		const endDate = getSilenceEnd(duration);
		return endDate !== null ? <span>Ends at {formatDate(endDate)}</span> : <span>Invalid duration</span>;
	}, [duration]);

	const matcherCards = useMemo(() => {
		return matchers.map((m) => <MatcherCard matcher={m} onDelete={() => removeMatcher(m)} />);
	}, [matchers]);

	return (
		<div class="w-full h-full flex flex-col justify-between">
			<h1 class="text-3xl mb-6 mt-6 font-bold">Add Silence</h1>

			<h2 class="text-xl">Duration</h2>
			<div class="flex justify-start flex-wrap items-center">
				<TextBox
					id="duration"
					title="Duration in Go format, e.g. 1h"
					pattern="[0-9]+[mhdw]"
					value={duration}
					onInput={handleSetDuration}
					valid={isDurationValid}
				/>

				<span class="pl-10">{end}</span>
			</div>

			<h2 class="text-xl pt-5">Matchers</h2>
			<div class="flex flex-row">
				<TextBox
					id="matcher"
					textRef={matchersInputRef}
					type="text"
					placeholder={`a="b"`}
					title='Matchers that this silence will match, e.g. label="value"'
					onKeyPress={(e) => {
						if (e.key === "Enter") {
							handleNewMatcher();
						}
					}}
					button={<PlusIcon class="inline size-5" />}
					onButtonClick={() => handleNewMatcher()}
				/>
			</div>

			<div class="flex flex-row flex-wrap flex-shrink flex-grow-0 pt-2">{matcherCards}</div>

			<h2 class="text-xl pt-5">Comment</h2>
			<TextBox id="comment" type="text" title="A comment explaining this silence" />

			<span>
				<Button text="Preview" color="warn" class="font-bold p-2 rounded mt-4" onClick={checkFormValidity} />
			</span>
		</div>
	);
};
