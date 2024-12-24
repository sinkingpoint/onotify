import { DurationSpec, milliSecondsToDuration } from "./duration";

test("duration 1s", () => {
	expect(DurationSpec.parse("1s")).toBe(1 * 1000);
});

test("duration 3h30m", () => {
	expect(DurationSpec.parse("3h30m")).toBe((3 * 60 * 60 + 30 * 60) * 1000);
});

test("duration unsupported units", () => {
	// We don't support ns, or microseconds.
	expect(() => DurationSpec.parse("500ns")).toThrow();
	expect(() => DurationSpec.parse("500us")).toThrow();
});

test("secondsToDuration", () => {
	expect(milliSecondsToDuration(1)).toEqual("1ms");
	expect(milliSecondsToDuration(1000)).toEqual("1s");
	expect(milliSecondsToDuration(60 * 1000)).toEqual("1m");
	expect(milliSecondsToDuration(60 * 60 * 1000)).toEqual("1h");

	expect(milliSecondsToDuration(90 * 60 * 1000)).toEqual("1h30m");
	expect(milliSecondsToDuration(95 * 60 * 1000)).toEqual("1h35m");
	expect(milliSecondsToDuration(95 * 60 * 1000 + 30 * 1000)).toEqual("1h35m30s");
});
