import { expect, it, vi } from "vitest";
import { makeAttempt, makeProblem } from "../test/factories";
import { loadExportAttempts, type FetchAttemptPage } from "./attemptExport";

it("requests five newest attempts and follows short pages only until five are collected", async () => {
  const fetchPage = vi
    .fn<FetchAttemptPage>()
    .mockResolvedValueOnce({
      page: [makeAttempt(8), makeAttempt(7)],
      isDone: false,
      continueCursor: "next",
    })
    .mockResolvedValueOnce({
      page: [makeAttempt(6), makeAttempt(5), makeAttempt(4)],
      isDone: false,
      continueCursor: "older",
    });
  const result = await loadExportAttempts([makeProblem({ attemptCount: 8 })], fetchPage);
  expect(result[0]!.attempts.map((attempt) => attempt._id)).toEqual([
    "attempt-8",
    "attempt-7",
    "attempt-6",
    "attempt-5",
    "attempt-4",
  ]);
  expect(fetchPage.mock.calls).toEqual([
    ["problem-default", null, 5],
    ["problem-default", "next", 3],
  ]);
});

it("retains empty histories and fails the entire export on a request error", async () => {
  const fetchPage = vi
    .fn<FetchAttemptPage>()
    .mockResolvedValueOnce({ page: [], isDone: true, continueCursor: "" });
  expect(await loadExportAttempts([makeProblem()], fetchPage)).toEqual([
    { problem: makeProblem(), attempts: [] },
  ]);
  fetchPage.mockRejectedValueOnce(new Error("Offline"));
  await expect(loadExportAttempts([makeProblem()], fetchPage)).rejects.toThrow("Offline");
});
