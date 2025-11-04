import { useMemo } from "preact/hooks";
import { MatcherCard } from "../../components/MatcherCard";
import { GetAlertsResponse } from "../../pkg/api/client";

interface HistoryEvent {
	ty: string;
	timestamp: string;
	comment?: string;
	userID?: string;
	fingerprint?: string;
}

interface HistoryEventCardProps {
	event: HistoryEvent;
	alert?: GetAlertsResponse[number];
}

export const HistoryEventCard = ({ event, alert }: HistoryEventCardProps) => {
	const formattedTime = useMemo(() => {
		return new Date(event.timestamp).toLocaleString();
	}, [event.timestamp]);

	const getEventColor = (type: string) => {
		switch (type) {
			case "firing":
				return "var(--error)";
			case "resolved":
				return "var(--success)";
			case "acknowledged":
				return "var(--info)";
			case "comment":
				return "var(--highlight)";
			case "silenced":
				return "var(--muted)";
			default:
				return "var(--text-color)";
		}
	};

	const getEventDescription = (event: HistoryEvent) => {
		switch (event.ty) {
			case "firing":
				return "Alert started firing";
			case "resolved":
				return "Alert was resolved";
			case "acknowledged":
				return `Alert was acknowledged${event.userID ? ` by ${event.userID}` : ""}`;
			case "comment":
				return `Comment added${event.userID ? ` by ${event.userID}` : ""}`;
			case "silenced":
				return "Alert was silenced";
			default:
				return `Alert state changed to ${event.ty}`;
		}
	};

	return (
		<a href={`/alerts/${event.fingerprint}`} class="flex flex-row alert-card justify-between p-3">
			<div class="flex items-start space-x-3 flex-1">
				<div class="flex-1 min-w-0">
					<div class="flex items-center justify-between">
						<h3 class="text-base font-medium capitalize" style={`color: ${getEventColor(event.ty)}`}>
							{event.ty}
						</h3>
						<span class="text-sm" style="color: var(--text-muted)">
							{formattedTime}
						</span>
					</div>

					<p class="text-sm mt-2" style="color: var(--text-color)">
						{getEventDescription(event)}
					</p>
					{event.comment && (
						<div class="mt-3 p-3 rounded text-sm" style="background-color: var(--bg-muted); color: var(--text-color);">
							"{event.comment}"
						</div>
					)}

					{event.fingerprint && (
						<div class="mt-2 text-sm" style="color: var(--text-muted)">
							Fingerprint: <span class="font-mono">{event.fingerprint}</span>
						</div>
					)}

					{alert && (
						<div class="mt-3 mb-2">
							<h4 class="text-sm font-semibold" style="color: var(--text-color)">
								{alert.labels.alertname || "Unknown Alert"}
							</h4>
							{alert.annotations?.summary && (
								<p class="text-sm mt-1" style="color: var(--text-muted)">
									{alert.annotations.summary}
								</p>
							)}
							<div class="flex flex-wrap gap-1 mt-2">
								{Object.entries(alert.labels)
									.filter(([key]) => key !== "alertname")
									.map(([key, value]) => (
										<MatcherCard key={key} matcher={{ name: key, value, isEqual: true, isRegex: false }} />
									))}
							</div>
						</div>
					)}
				</div>
			</div>
		</a>
	);
};
