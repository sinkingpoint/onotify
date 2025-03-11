import { HTMLAttributes } from "preact/compat";
import { formatDate } from "../../pages/AddSilence/utils";
import { GetAlertsResponse } from "../../pkg/api/client";
import { MatcherCard } from "../MatcherCard";

interface AlertCardProps extends HTMLAttributes<HTMLSpanElement> {
	alert: GetAlertsResponse[number];
}

export const AlertCard = ({ alert, ...props }: AlertCardProps) => {
	const startsAt = Date.parse(alert.startsAt);
	const endsAt = Date.parse(alert.endsAt);

	const startedAt = startsAt > Date.now() ? "Starts" : "Started";
	const endedAt = endsAt > Date.now() ? "Ends" : "Ended";

	const classes = "flex flex-col " + (props.class ? props.class : "");
	return (
		<span {...props} class={classes}>
			<span>
				<label class="inline font-bold">Alert Name: </label>
				{alert.labels["alertname"] ? <span>{alert.labels["alertname"]}</span> : <span class="italic">None</span>}
			</span>

			<span>
				<label class="inline font-bold">{startedAt}</label>: {formatDate(new Date(startsAt))}
			</span>

			{endsAt > 0 && (
				<span>
					<label class="inline font-bold">{endedAt}</label>: {formatDate(new Date(endsAt))}
				</span>
			)}

			<span>
				<label class="inline font-bold">Labels:</label>
				<span class="flex flex-row">
					{Object.keys(alert.labels).map((labelName) => (
						<MatcherCard matcher={{ name: labelName, value: alert.labels[labelName], isEqual: true, isRegex: false }} />
					))}
				</span>
			</span>
		</span>
	);
};
