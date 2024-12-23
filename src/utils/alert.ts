import { Alert } from "../types/internal";

export const alertIsSame = (a1: Alert, a2: Alert): boolean => {
	const a1AnnotationsKeys = Object.keys(a1);
	const a2AnnotationsKeys = Object.keys(a2);
	return (
		a1.fingerprint === a2.fingerprint &&
		a1.startsAt === a2.startsAt &&
		a1.endsAt === a2.endsAt &&
		a1AnnotationsKeys.length === a2AnnotationsKeys.length &&
		a1AnnotationsKeys.every((k) => a1.annotations[k] === a2.annotations[k])
	);
};
