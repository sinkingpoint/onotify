import { Matcher } from "../types/api";
import { getAnchoredRegex } from "./regex";

// Returns true if the given matcher matches the given alert.
export const matcherMatches = (m: Matcher, labels: Record<string, string>, regexCache?: Record<string, RegExp>) => {
	const labelValue = labels[m.name] || "";
	let test = false;
	if (m.isRegex) {
		const regex = getAnchoredRegex(m.value, regexCache);
		test = regex.test(labelValue);
	} else {
		test = m.value === labelValue;
	}

	if (m.isEqual) {
		return test;
	} else {
		return !test;
	}
};

// Returns true if the given matchers are functionally the same.
export const matcherIsSame = (m1: Matcher, m2: Matcher): boolean => {
	return m1.name === m2.name && m1.value === m2.value && m1.isEqual === m2.isEqual && m1.isRegex === m2.isRegex;
};
