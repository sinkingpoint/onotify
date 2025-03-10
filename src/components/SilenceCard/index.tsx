import { HTMLAttributes } from "preact/compat";
import { GettableSilence } from "../../pkg/types/api";
import { MatcherCard } from "../MatcherCard";

interface SilenceCardProps extends HTMLAttributes<HTMLSpanElement> {
	silence: GettableSilence;
}

export const SilenceCard = ({ silence, ...props }: SilenceCardProps) => {
	const startedAt = (silence.startsAt > Date.now() ? "Starts" : "Started") + " at: ";
	const endedAt = (silence.endsAt > Date.now() ? "Ends" : "Ended") + " at: ";

	return (
		<span {...props} class={"flex flex-col " + (props.class ? props.class : "")}>
			<span>
				<a class="font-bold" href={`/silences/${silence.id}`}>
					ID: {silence.id}
				</a>
			</span>
			<span>
				<span class="font-bold">Created by: </span>
				{silence.createdBy}
			</span>
			<span class="flex flex-row justify-between">
				<span class="pr-3">
					<span class="font-bold">{startedAt}</span> {new Date(silence.startsAt).toISOString()}
				</span>
				<span>
					<span class="font-bold">{endedAt}</span> {new Date(silence.endsAt).toISOString()}
				</span>
			</span>
			<span>
				<span class="font-bold">Comment: </span>
				{silence.comment}
			</span>
			<span class="flex flex-row">
				{silence.matchers.map((m) => (
					<MatcherCard matcher={m} />
				))}
			</span>
		</span>
	);
};
