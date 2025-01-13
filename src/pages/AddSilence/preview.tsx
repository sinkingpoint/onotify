import { useEffect, useMemo, useState } from "preact/hooks";
import { MatcherCard } from "../../components/MatcherCard";
import { GettableAlert, Matcher } from "../../pkg/types/api";
import { DurationSpec } from "../../pkg/types/duration";
import { formatDate } from "./utils";

export interface PreviewProps {
	duration: string;
	matchers: Matcher[];
	comment: string;
}

export const PreviewSilence = ({ duration, matchers, comment }: PreviewProps) => {
	const startTime = useMemo(() => {
		return new Date();
	}, []);

	const endTime = useMemo(() => {
		const realDuration = DurationSpec.parse(duration);
		return new Date(startTime.getTime() + realDuration);
	}, [duration, startTime]);

	const [alerts, setAlerts] = useState<GettableAlert[]>();
	useEffect(() => {
		const fetch = async () => {};

		fetch();
	}, [matchers]);

	return (
		<>
			<span>
				<h2 class="text-xl inline">Starts:</h2> {formatDate(startTime)}
			</span>
			<span>
				<h2 class="text-xl inline">Ends:</h2> {formatDate(endTime)}
			</span>
			<span>
				<h2 class="text-xl">Matchers:</h2>

				<div class="flex flex-row flex-wrap flex-shrink flex-grow-0">
					{matchers.map((m) => (
						<MatcherCard matcher={m} />
					))}
				</div>
			</span>

			<span>
				<h2 class="text-xl inline pt-4">Comment:</h2> {comment}
			</span>

			<span>
				<h2 class="text-xl inline pt-4">Affect Alerts:</h2>
			</span>
		</>
	);
};
