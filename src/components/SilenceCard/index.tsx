import { ChevronRightIcon } from "@heroicons/react/16/solid";
import { HTMLAttributes } from "preact/compat";
import { formatDate } from "../../pages/AddSilence/utils";
import { GettableSilence, Matcher } from "../../pkg/types/api";
import { MatcherCard } from "../MatcherCard";
import "./style.css";

interface SilenceCardProps extends HTMLAttributes<HTMLSpanElement> {
	silence: Omit<GettableSilence, "matchers"> & { matchers: Matcher[] };
}

export const SilenceCard = ({ silence, ...props }: SilenceCardProps) => {
	const startedAt = (silence.startsAt > Date.now() ? "Starts" : "Started") + " at: ";
	const endedAt = (silence.endsAt > Date.now() ? "Ends" : "Ended") + " at: ";

	return (
		<a href={`/silences/${silence.id}`} class="flex flex-row silence-card justify-between p-3">
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
				<span class="flex flex-col md:flex-row justify-between">
					<span class="pr-3">
						<span class="font-bold">{startedAt}</span> {formatDate(new Date(silence.startsAt))}
					</span>
					<span>
						<span class="font-bold">{endedAt}</span> {formatDate(new Date(silence.endsAt))}
					</span>
				</span>
				<span>
					<span class="font-bold">Comment: </span>
					{silence.comment}
				</span>
				<span class="flex flex-wrap">
					{silence.matchers.map((m) => (
						<MatcherCard matcher={m} />
					))}
				</span>
			</span>

			<ChevronRightIcon class="inline size-10 self-center silence-card-view-btn" />
		</a>
	);
};
