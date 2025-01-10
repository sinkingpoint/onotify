import { DurationSpec } from "../../pkg/types/duration";

export const formatDate = (d: Date): string => {
	return (
		d.toLocaleString([], {
			day: "numeric",
			month: "short",
			year: "numeric",
		}) +
		" at " +
		d.toLocaleString([], {
			hour: "2-digit",
			minute: "2-digit",
		})
	);
};

export const getSilenceEnd = (duration: string) => {
	try {
		const millis = DurationSpec.parse(duration);
		return new Date(Date.now() + millis);
	} catch {
		return null;
	}
};
