import { expect, it, vi } from "vitest";
import { makeAttempt, makeCategory, makeProblem } from "../test/factories";
import { exportRange, loadExportAttempts, type FetchAttemptPage } from "./attemptExport";
import { buildTopicStats, topicsCsv } from "./topicStats";

it("counts all attempts across pages while retaining just five newest notes", async () => {
  const fetchPage = vi
    .fn<FetchAttemptPage>()
    .mockResolvedValueOnce({
      page: [makeAttempt(8), makeAttempt(7)],
      isDone: false,
      continueCursor: "next",
    })
    .mockResolvedValueOnce({
      page: [makeAttempt(6), makeAttempt(5), makeAttempt(4), makeAttempt(3), makeAttempt(2)],
      isDone: true,
      continueCursor: "",
    });
  const result = await loadExportAttempts([makeProblem()], fetchPage);
  expect(result[0]!.attempts.map((attempt) => attempt._id)).toEqual([
    "attempt-8",
    "attempt-7",
    "attempt-6",
    "attempt-5",
    "attempt-4",
  ]);
  expect(result[0]!.problem.attemptCount).toBe(7);
  expect(fetchPage.mock.calls).toEqual([
    ["problem-default", null, 100],
    ["problem-default", "next", 100],
  ]);
});

it("filters by attempt date, includes boundaries, and recomputes summary grades within the range", async () => {
  const category = makeCategory("DFS");
  const problem = makeProblem({
    categoryIds: [category._id],
    categories: [category],
    latestGrade: "A",
    attemptCount: 99,
  });
  const fetchPage = vi
    .fn<FetchAttemptPage>()
    .mockResolvedValueOnce({
      page: [{ ...makeAttempt(9), grade: "A" }, makeAttempt(8)],
      isDone: false,
      continueCursor: "next",
    })
    .mockResolvedValueOnce({
      page: [{ ...makeAttempt(7), grade: "F" }, makeAttempt(6), makeAttempt(5)],
      isDone: false,
      continueCursor: "older",
    });
  const result = await loadExportAttempts([problem], fetchPage, {
    start: Date.UTC(2026, 8, 6),
    end: Date.UTC(2026, 8, 8),
  });
  expect(result[0]!.attempts.map((attempt) => attempt._id)).toEqual(["attempt-7", "attempt-6"]);
  expect(result[0]!.problem).toMatchObject({ attemptCount: 2, latestGrade: "F" });
  expect(fetchPage).toHaveBeenCalledTimes(2);
  const summary = buildTopicStats(
    [category],
    result.map(({ problem: item }) => item),
  );
  expect(summary[0]).toMatchObject({ attempted: 1, attempts: 2, average: 0 });
  const csv = topicsCsv(summary, result);
  expect(csv).toContain('"DFS","1","2","0.00"');
  expect(csv).toContain('"Notes 7"');
  expect(csv).not.toContain('"Notes 9"');
});

it("omits problems with no matching attempts and propagates read failures", async () => {
  const fetchPage = vi
    .fn<FetchAttemptPage>()
    .mockResolvedValueOnce({ page: [], isDone: true, continueCursor: "" });
  expect(await loadExportAttempts([makeProblem()], fetchPage)).toEqual([]);
  fetchPage.mockResolvedValueOnce({ page: [makeAttempt(1)], isDone: true, continueCursor: "" });
  expect(
    await loadExportAttempts([makeProblem()], fetchPage, {
      start: Date.UTC(2026, 8, 2),
      end: Infinity,
    }),
  ).toEqual([]);
  fetchPage.mockRejectedValueOnce(new Error("Offline"));
  await expect(loadExportAttempts([makeProblem()], fetchPage)).rejects.toThrow("Offline");
});

it("supports all time, rolling month/year, and inclusive custom calendar dates", () => {
  const now = new Date(2026, 8, 24, 12);
  expect(exportRange("all")).toEqual({ start: -Infinity, end: Infinity });
  const monthStart = new Date(now);
  monthStart.setDate(monthStart.getDate() - 30);
  const yearStart = new Date(now);
  yearStart.setDate(yearStart.getDate() - 365);
  expect(exportRange("month", "", "", now)).toEqual({ start: +monthStart, end: +now + 1 });
  expect(exportRange("year", "", "", now)).toEqual({ start: +yearStart, end: +now + 1 });
  expect(exportRange("custom", "2026-09-01", "2026-09-24")).toEqual({
    start: +new Date(2026, 8, 1),
    end: +new Date(2026, 8, 25),
  });
  expect(() => exportRange("custom", "", "")).toThrow("valid start and end");
  expect(() => exportRange("custom", "2026-09-24", "2026-09-01")).toThrow("valid start and end");
});
