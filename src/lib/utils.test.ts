import { describe, expect, it } from "vitest";
import { makeProblem } from "../test/factories";
import { averageGrade, getErrorMessage, sortProblems } from "./utils";

describe("problem summary utilities", () => {
  const unattempted = makeProblem({
    name: "Unattempted",
    attemptCount: 0,
    createdAt: 400,
  });
  const strong = makeProblem({
    name: "Array Search",
    attemptCount: 2,
    latestAttemptAt: 300,
    latestGrade: "A",
  });
  const practiced = makeProblem({
    name: "Binary Tree",
    attemptCount: 5,
    latestAttemptAt: 200,
    latestGrade: "C",
  });

  it("sorts without mutating the source list", () => {
    const source = [strong, unattempted, practiced];

    expect(sortProblems(source, "attempts").map((problem) => problem.name)).toEqual([
      "Binary Tree",
      "Array Search",
      "Unattempted",
    ]);
    expect(sortProblems(source, "grade").map((problem) => problem.name)).toEqual([
      "Array Search",
      "Binary Tree",
      "Unattempted",
    ]);
    expect(sortProblems(source, "name").map((problem) => problem.name)).toEqual([
      "Array Search",
      "Binary Tree",
      "Unattempted",
    ]);
    expect(source.map((problem) => problem.name)).toEqual([
      "Array Search",
      "Unattempted",
      "Binary Tree",
    ]);
  });

  it("uses creation time as the recent-sort fallback for an unattempted problem", () => {
    expect(sortProblems([strong, unattempted, practiced], "recent")[0]).toBe(unattempted);
  });

  it("averages only attempted problems", () => {
    expect(averageGrade([strong, practiced, unattempted])).toBe("B");
    expect(averageGrade([unattempted])).toBe("—");
  });
});

describe("getErrorMessage", () => {
  it("extracts the useful message from a Convex error", () => {
    const error = new Error(
      "[CONVEX M(problems:create)] Uncaught ConvexError: Enter a valid problem link.\n    at handler",
    );

    expect(getErrorMessage(error)).toBe("Enter a valid problem link.");
  });

  it("returns a safe fallback for non-errors", () => {
    expect(getErrorMessage("failure")).toBe("Something went wrong.");
  });
});
