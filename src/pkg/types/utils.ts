import { Matcher } from "./api";

export const matcherToString = (matcher: Matcher) => {
	let comparison = "";
	if (matcher.isEqual) {
		if (matcher.isRegex) {
			comparison = "=~";
		} else {
			comparison = "=";
		}
	} else {
		if (matcher.isRegex) {
			comparison = "!~";
		} else {
			comparison = "!=";
		}
	}

	return `${matcher.name}${comparison}"${matcher.value}"`;
};
