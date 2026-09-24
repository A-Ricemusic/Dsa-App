import { expect, it } from "vitest";
import { makeCategory, makeProblem } from "../test/factories";
import { buildTopicStats, topicFocus, topicsCsv } from "./topicStats";

it("counts unique attempted questions per topic and weights latest grades equally", () => {
  const dfs = makeCategory("Depth-first search");
  const trees = makeCategory("Binary tree");
  const rows = buildTopicStats(
    [dfs, trees],
    [
      makeProblem({
        categoryIds: [dfs._id, dfs._id, trees._id],
        attemptCount: 10,
        latestGrade: "A",
      }),
      makeProblem({
        categoryIds: [dfs._id],
        attemptCount: 1,
        latestGrade: "F",
        latestShouldReview: true,
      }),
      makeProblem({ categoryIds: [dfs._id], attemptCount: 0 }),
      makeProblem({ categoryIds: [dfs._id], attemptCount: 1 }),
    ],
  );
  expect(rows.find((row) => row.id === dfs._id)).toMatchObject({
    questions: 4,
    attempted: 3,
    attempts: 12,
    graded: 2,
    average: 2,
    toReview: 1,
  });
  expect(rows.find((row) => row.id === trees._id)).toMatchObject({
    questions: 1,
    attempted: 1,
    attempts: 10,
    graded: 1,
    average: 4,
  });
});

it("orders weak topics, coverage gaps, reviews, and strong topics without treating missing grades as F", () => {
  const categories = ["Strong", "Weak", "Unpracticed", "Review"].map((name) => makeCategory(name));
  const rows = buildTopicStats(categories, [
    makeProblem({ categoryIds: [categories[0]!._id], attemptCount: 1, latestGrade: "A" }),
    makeProblem({ categoryIds: [categories[1]!._id], attemptCount: 1, latestGrade: "F" }),
    makeProblem({
      categoryIds: [categories[3]!._id],
      attemptCount: 1,
      latestGrade: "B",
      latestShouldReview: true,
    }),
  ]);
  expect(rows.map((row) => row.name)).toEqual(["Weak", "Unpracticed", "Review", "Strong"]);
  expect(rows[1]).toMatchObject({ attempted: 0, average: null });
  expect(rows.map(topicFocus)).toEqual([
    "Needs practice",
    "Not practiced",
    "Review flagged",
    "Keep practicing",
  ]);
  expect(buildTopicStats([], [])).toEqual([]);
  expect(buildTopicStats([], [makeProblem({ attemptCount: 1 })])[0]).toMatchObject({
    name: "Uncategorized",
    attempted: 1,
    average: null,
  });
});

it("exports precise scores, zero grades, missing grades, rules, timestamp, and safe quoted names", () => {
  const categories = [
    makeCategory('Trees, "binary"\nDFS'),
    makeCategory("=SUM(1+1)"),
    makeCategory("Empty"),
  ];
  const rows = buildTopicStats(categories, [
    makeProblem({ categoryIds: [categories[0]!._id], attemptCount: 1, latestGrade: "F" }),
  ]);
  const csv = topicsCsv(rows, new Date("2026-09-24T12:00:00Z"));
  expect(csv).toContain('"Trees, ""binary""\nDFS","1","1","1","1","0.00"');
  expect(csv).toContain('"\'=SUM(1+1)"');
  expect(csv).toContain('"Empty","0","0","0","0",""');
  expect(csv).toContain("2026-09-24T12:00:00.000Z");
  expect(csv).toContain("A=4 B=3 C=2 D=1 F=0");
  expect(csv).toContain("multi-topic questions count in each topic");
});
