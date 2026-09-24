import { expect, it } from "vitest";
import { makeAttempt, makeCategory, makeProblem } from "../test/factories";
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

it("appends exactly five rows per problem, keeps full notes, and pads absent attempts", () => {
  const problem = makeProblem();
  const csv = topicsCsv(buildTopicStats([], [problem]), new Date("2026-09-24T12:00:00Z"), [
    {
      problem,
      attempts: [
        makeAttempt(3, 'Used "DFS", then BFS\nReview recursion → stack'),
        makeAttempt(2, "=unsafe formula"),
        makeAttempt(1, ""),
      ],
    },
  ]);
  expect(csv).toContain('"Attempt notes"');
  expect(csv.match(/"Problem attempt"/g)).toHaveLength(5);
  expect(csv).toContain(
    '"1","attempt-3","2026-09-03T00:00:00.000Z","C","Yes","Used ""DFS"", then BFS\nReview recursion → stack"',
  );
  expect(csv).toContain('"2","attempt-2","2026-09-02T00:00:00.000Z","C","Yes","\'=unsafe formula"');
  expect(csv).toContain('"3","attempt-1","2026-09-01T00:00:00.000Z","C","Yes","NA"');
  expect(csv).toContain('"4","NA","NA","NA","NA","NA"');
  expect(csv).toContain('"5","NA","NA","NA","NA","NA"');
});

it("never exports more than five attempts and gives every record the same column count", () => {
  const problem = makeProblem();
  const csv = topicsCsv(buildTopicStats([], [problem]), new Date(), [
    { problem, attempts: Array.from({ length: 7 }, (_, index) => makeAttempt(7 - index)) },
  ]);
  const lines = csv.trim().split("\r\n");
  expect(lines).toHaveLength(7);
  expect(new Set(lines.map((line) => line.split('","').length))).toEqual(new Set([21]));
  expect(csv).toContain('"attempt-7"');
  expect(csv).toContain('"attempt-3"');
  expect(csv).not.toContain('"attempt-2"');
  expect(csv).not.toContain('"attempt-1"');
});
