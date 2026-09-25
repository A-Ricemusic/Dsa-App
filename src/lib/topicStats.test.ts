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

it("exports category summary first, then one row per problem with five separate notes columns", () => {
  const category = makeCategory("DFS");
  const problem = makeProblem({
    name: "Tree traversal",
    attemptCount: 7,
    categoryIds: [category._id],
    categories: [category],
    latestGrade: "C",
  });
  const attempts = Array.from({ length: 7 }, (_, index) => makeAttempt(7 - index));
  const csv = topicsCsv(buildTopicStats([category], [problem]), [{ problem, attempts }]);
  const lines = csv.trim().split("\r\n");
  expect(lines).toHaveLength(5);
  expect(lines[0]).toContain(
    '"Topic","Questions attempted","Total attempts","Average latest grade (0-4)"',
  );
  expect(lines[1]).toContain('"DFS","1","7","2.00"');
  expect(lines[3]).toContain(
    '"Problem","Problem URL","Difficulty","Topics","Latest grade","Total attempts"',
  );
  expect(lines[4]).toContain('"Tree traversal"');
  expect(new Set(lines.map((line) => line.split('","').length))).toEqual(new Set([21]));
  for (let index = 1; index <= 5; index++) expect(lines[3]).toContain(`"Attempt notes ${index}"`);
  expect(lines[4]).toContain('"Notes 7"');
  expect(lines[4]).toContain('"Notes 3"');
  expect(csv).not.toContain('"Notes 2"');
  expect(csv).not.toContain('"Notes 1"');
  for (const removed of [
    "Record",
    "Record type",
    "Problem ID",
    "Attempt ID",
    "Attempt date (UTC)",
    "Exported at (UTC)",
    "Methodology",
  ])
    expect(csv).not.toContain(`"${removed}"`);
});

it("preserves full multiline notes and pads missing attempts in the same problem row", () => {
  const problem = makeProblem({ attemptCount: 3 });
  const csv = topicsCsv(
    [],
    [
      {
        problem,
        attempts: [
          makeAttempt(3, 'Used "DFS", then BFS\nReview recursion → stack'),
          makeAttempt(2, "=unsafe formula"),
          makeAttempt(1, ""),
        ],
      },
    ],
  );
  expect(csv).toContain('"Used ""DFS"", then BFS\nReview recursion → stack"');
  expect(csv).toContain('"\'=unsafe formula"');
  expect(csv).toContain('"C","Yes","NA","NA","NA","NA","NA","NA","NA"');
  expect(csv.match(/"Default Problem"/g)).toHaveLength(1);
});

it("exports zero grades, safe topic names, and no unattempted problem rows", () => {
  const categories = [
    makeCategory('Trees, "binary"\nDFS'),
    makeCategory("=SUM(1+1)"),
    makeCategory("Empty"),
  ];
  const problem = makeProblem({
    categoryIds: [categories[0]!._id],
    attemptCount: 1,
    latestGrade: "F",
  });
  const csv = topicsCsv(buildTopicStats(categories, [problem]), [
    { problem: makeProblem(), attempts: [] },
  ]);
  expect(csv).toContain('"Trees, ""binary""\nDFS","1","1","0.00"');
  expect(csv).toContain('"\'=SUM(1+1)"');
  expect(csv).toContain('"Empty","0","0","NA"');
  expect(csv).not.toContain('"Default Problem"');
});
