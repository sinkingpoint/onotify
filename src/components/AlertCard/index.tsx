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
				<h3 class="text-lg inline font-bold">Alert Name: </h3>
				{alert.labels["alertname"] ? <span>{alert.labels["alertname"]}</span> : <span class="italic">None</span>}
			</span>

			<span>
				<h3 class="text-lg inline font-bold">{startedAt}</h3>: {formatDate(new Date(startsAt))}
			</span>

			{endsAt > 0 && (
				<span>
					<h2 class="text-lg inline font-bold">{endedAt}</h2>: {formatDate(new Date(endsAt))}
				</span>
			)}

			<span>
				<h3 class="text-lg inline font-bold">Labels:</h3>
				<span class="flex flex-row">
					{Object.keys(alert.labels).map((labelName) => (
						<MatcherCard matcher={{ name: labelName, value: alert.labels[labelName], isEqual: true, isRegex: false }} />
					))}
				</span>
			</span>
		</span>
	);
};
