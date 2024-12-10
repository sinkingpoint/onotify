import {
  AlertmanagerConfigSpec,
  DaysOfMonthRange,
  DurationSpec,
  StringMatcherSpec,
  MonthRange,
  TimeSpec,
  WeekdayRangeSpec,
  YearRange,
} from "./alertmanager";

import fs from "fs";
import yaml from "js-yaml";

test("TimeSpec 01:23", () => {
  expect(TimeSpec.parse("01:23")).toEqual({ hour: 1, minute: 23 });
});

test("TimeSpec 00:00", () => {
  expect(TimeSpec.parse("00:00")).toEqual({ hour: 0, minute: 0 });
});

test("TimeSpec 23:59", () => {
  expect(TimeSpec.parse("23:59")).toEqual({ hour: 23, minute: 59 });
});

test("TimeSpec -1:23", () => {
  expect(() => TimeSpec.parse("25:23")).toThrow();
});

test("TimeSpec 25:-1", () => {
  expect(() => TimeSpec.parse("25:-1")).toThrow();
});

test("TimeSpec 25:67", () => {
  expect(() => TimeSpec.parse("25:67")).toThrow();
});

test("TimeSpec 24:00", () => {
  expect(() => TimeSpec.parse("24:00")).toThrow();
});

test("TimeSpec 23:60", () => {
  expect(() => TimeSpec.parse("23:60")).toThrow();
});

test("WeekdayRange monday:wednesday", () => {
  expect(WeekdayRangeSpec.parse("monday:wednesday")).toEqual({
    type: "range",
    start: 0,
    end: 2,
  });
});

test("WeekdayRange saturday", () => {
  expect(WeekdayRangeSpec.parse("saturday")).toEqual({
    type: "single",
    day: 5,
  });
});

test("WeekdayRange sunday", () => {
  expect(WeekdayRangeSpec.parse("sunday")).toEqual({
    type: "single",
    day: 6,
  });
});

test("WeekdayRange not a day", () => {
  expect(() => WeekdayRangeSpec.parse("not a day")).toThrow();
});

test("WeekdayRange 0", () => {
  expect(() => WeekdayRangeSpec.parse("0")).toThrow();
});

test("WeekdayRange wednesday:monday", () => {
  expect(() => WeekdayRangeSpec.parse("wednesday:monday")).toThrow();
});

test("DaysOfMonthRange 1", () => {
  expect(DaysOfMonthRange.parse("1")).toEqual({ type: "single", day: 1 });
});

test("DaysOfMonthRange -1", () => {
  expect(DaysOfMonthRange.parse("-1")).toEqual({ type: "single", day: -1 });
});

test("DaysOfMonthRange 1:5", () => {
  expect(DaysOfMonthRange.parse("1:5")).toEqual({
    type: "range",
    start: 1,
    end: 5,
  });
});

test("DaysOfMonthRange -3:-1", () => {
  expect(DaysOfMonthRange.parse("-3:-1")).toEqual({
    type: "range",
    start: -3,
    end: -1,
  });
});

test("DaysOfMonthRange 1:31", () => {
  expect(DaysOfMonthRange.parse("1:31")).toEqual({
    type: "range",
    start: 1,
    end: 31,
  });
});

test("DaysOfMonthRange 0", () => {
  expect(() => DaysOfMonthRange.parse("0")).toThrow();
});

test("MonthRange 1", () => {
  expect(MonthRange.parse("1")).toEqual({ type: "single", month: 1 });
});

test("MonthRange january", () => {
  expect(MonthRange.parse("january")).toEqual({ type: "single", month: 1 });
});

test("MonthRange January", () => {
  expect(MonthRange.parse("January")).toEqual({ type: "single", month: 1 });
});

test("MonthRange 1:3", () => {
  expect(MonthRange.parse("1:3")).toEqual({ type: "range", start: 1, end: 3 });
});

test("MonthRange 3:1", () => {
  expect(MonthRange.parse("3:1")).toEqual({ type: "range", start: 3, end: 1 });
});

test("MonthRange may:august", () => {
  expect(MonthRange.parse("may:august")).toEqual({
    type: "range",
    start: 5,
    end: 8,
  });
});

test("MonthRange december", () => {
  expect(MonthRange.parse("december")).toEqual({
    type: "single",
    month: 12,
  });
});

test("MonthRange 0", () => {
  expect(() => MonthRange.parse("0")).toThrow();
});

test("MonthRange not a month", () => {
  expect(() => MonthRange.parse("not a month")).toThrow();
});

test("Year Range 2024", () => {
  expect(YearRange.parse("2024")).toEqual({ type: "single", year: 2024 });
});

test("Year Range 2020:2022", () => {
  expect(YearRange.parse("2020:2022")).toEqual({
    type: "range",
    start: 2020,
    end: 2022,
  });
});

test("YearRange not a year", () => {
  expect(() => YearRange.parse("not a year")).toThrow();
});

test("YearRange not a 2024:2020", () => {
  expect(() => YearRange.parse("2024:2020")).toThrow();
});

test("MatcherSpec a=b", () => {
  expect(StringMatcherSpec.parse(`a="b"`)).toEqual({
    name: "a",
    value: "b",
    isEqual: true,
    isRegex: false,
  });
});

test("MatcherSpec a!=b", () => {
  expect(StringMatcherSpec.parse(`a!="b"`)).toEqual({
    name: "a",
    value: "b",
    isEqual: false,
    isRegex: false,
  });
});

test("MatcherSpec a=~b", () => {
  expect(StringMatcherSpec.parse(`a=~"b"`)).toEqual({
    name: "a",
    value: "b",
    isEqual: true,
    isRegex: true,
  });
});

test("MatcherSpec a!~b", () => {
  expect(StringMatcherSpec.parse(`a!~"b"`)).toEqual({
    name: "a",
    value: "b",
    isEqual: false,
    isRegex: true,
  });
});

test("MatcherSpec escaped quote", () => {
  expect(StringMatcherSpec.parse(`a="b\""`)).toEqual({
    name: "a",
    value: 'b"',
    isEqual: true,
    isRegex: false,
  });
});

test("MatcherSpec missing quote", () => {
  expect(() => StringMatcherSpec.parse(`a=b\""`)).toThrow();
});

const readYamlFile = (path: string): any => {
  const rawConfig = fs.readFileSync(path).toString();
  return yaml.load(rawConfig);
};

test("Full Config", () => {
  const config = AlertmanagerConfigSpec.parse(
    readYamlFile("testdata/simple.yaml")
  );

  // Test that configs get filtered down the tree.
  expect(config.route.group_wait).toEqual(30 * 1000);
  expect(config.route.group_by).toEqual(["alertname", "cluster", "service"]);
  expect(config.route.routes![0].group_wait).toEqual(1000 * 5 * 60);
  expect(config.route.routes![0].group_by).toEqual([
    "alertname",
    "cluster",
    "service",
  ]);
  expect(config.mute_time_intervals);
});

test("duplicated route", () => {
  const raw = readYamlFile("testdata/duplicated-receiver.yaml");
  expect(() => AlertmanagerConfigSpec.parse(raw)).toThrow();
});

test("unknown value", () => {
  const raw = readYamlFile("testdata/unknown-value.yaml");
  expect(() => AlertmanagerConfigSpec.parse(raw)).toThrow();
});

test("duplicated time interval", () => {
  const raw = readYamlFile("testdata/duplicated-time-interval-1.yaml");
  expect(() => AlertmanagerConfigSpec.parse(raw)).toThrow();
});

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
