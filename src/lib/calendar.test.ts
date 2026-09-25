import { expect, it } from "vitest";
import { calendarDate, calendarDays, parseCalendarDate } from "./calendar";

it("keeps calendar dates local and includes leap days", () => {
  expect(calendarDate(parseCalendarDate("2028-02-29"))).toBe("2028-02-29");
  const days = calendarDays(new Date(2028, 1, 1));
  expect(days).toHaveLength(42);
  expect(days[0]!.getDay()).toBe(0);
  expect(days.map(calendarDate)).toContain("2028-02-29");
  expect(new Set(days.map(calendarDate)).size).toBe(42);
});

it("spans the year boundary without skipping dates", () => {
  const days = calendarDays(new Date(2026, 0, 1)).map(calendarDate);
  expect(days[0]).toBe("2025-12-28");
  expect(days.at(-1)).toBe("2026-02-07");
});
