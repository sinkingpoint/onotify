import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
extendZodWithOpenApi(z);

// Handles Go duration types, like 30s, 3h1m, or 0.5m.
export const DurationSpec = z
	.string()
	.transform((s) => {
		let d = 0;
		let neg = false;
		let orig = s;

		if (s !== "") {
			const c = s[0];
			if (c === "-" || c === "+") {
				neg = c === "-";
				s = s.substring(1);
			}
		}

		if (s === "0") {
			return 0;
		}

		if (s === "") {
			throw `invalid duration: "${orig}`;
		}

		while (s !== "") {
			let scale = 1;
			let f = 0;
			if (!(s[0] === "." || ("0" <= s[0] && s[0] <= "9"))) {
				throw `invalid duration: "${orig}"`;
			}

			let pl = s.length;
			const leading = leadingInt(s);
			let v = leading[0];
			s = leading[1];

			const pre = pl != s.length;
			let post = false;
			if (s !== "" && s[0] === ".") {
				s = s.substring(1);
				pl = s.length;
				const [newF, newScale, newS] = leadingFraction(s);
				s = newS;
				post = pl != s.length;
				f = newF;
				scale = newScale;
			}

			if (!pre && !post) {
				// no digits (e.g. ".s" or "-.s")
				throw `invalid duration: "${orig}"`;
			}

			let i = 0;
			for (; i < s.length; i++) {
				const c = s[i];
				if (c === "." || ("0".charCodeAt(0) <= c.charCodeAt(0) && c.charCodeAt(0) <= "9".charCodeAt(0))) {
					break;
				}
			}

			if (i === 0) {
				throw `missing unit in duration: "${orig}"`;
			}

			const u = s.substring(0, i);
			s = s.substring(i);
			if (!isUnitAllowed(u)) {
				throw `unsupported unit ${u}`;
			}

			const unit = unitMap(u);
			if (unit === null) {
				throw `unknown unit '${u}' in duration: ${orig}`;
			}

			v *= unit;
			if (f > 0) {
				v += f * (unit / scale);
			}

			d += v;
		}
		if (neg) {
			return -d;
		}

		return d;
	})
	.openapi({
		description: "a string duration",
		examples: ["2h", "5m30s"],
	});

export const milliSecondsToDuration = (s: number) => {
	let time = "";
	for (const unit of ["h", "m", "s", "ms"]) {
		const multiplier = unitMap(unit);
		if (!multiplier) {
			throw `BUG: Unhandled unit`;
		}

		if (s >= multiplier) {
			const amt = Math.floor(s / multiplier);
			s -= amt * multiplier;
			time += `${amt}${unit}`;
		}
	}

	if (time === "") {
		throw `BUG: failed to get time for ${s} milliseconds`;
	}

	return time;
};

const leadingInt = (s: string): [number, string] => {
	let i = 0;
	let x = 0;
	for (; i < s.length; i++) {
		const c = s[i];
		if (c.charCodeAt(0) < "0".charCodeAt(0) || c.charCodeAt(0) > "9".charCodeAt(0)) {
			break;
		}

		x = x * 10 + (c.charCodeAt(0) - "0".charCodeAt(0));
	}

	return [x, s.substring(i)];
};

const leadingFraction = (s: string): [number, number, string] => {
	let i = 0;
	let scale = 1;
	let x = 0;
	for (; i < s.length; i++) {
		const c = s[i];
		if (c.charCodeAt(0) < "0".charCodeAt(0) || c.charCodeAt(0) > "9".charCodeAt(0)) {
			break;
		}

		x = x * 10 + (c.charCodeAt(0) - "0".charCodeAt(0));
		scale *= 10;
	}

	return [x, scale, s.substring(i)];
};

// Returns false if the given string is technically a valid duration unit in Go,
// but we choose not to support it here.
const isUnitAllowed = (s: string): boolean => {
	switch (s) {
		case "ns":
		case "us":
		case "µs":
		case "μs":
			return false;
	}

	return true;
};

// Returns the number of milliseconds in one of the given unit.
const unitMap = (s: string): number | null => {
	const millisecond = 1;
	const second = 1000 * millisecond;
	const minute = 60 * second;
	const hour = 60 * minute;
	switch (s) {
		case "ms":
			return millisecond;
		case "s":
			return second;
		case "m":
			return minute;
		case "h":
			return hour;
	}

	return null;
};
