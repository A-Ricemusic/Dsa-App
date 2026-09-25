import type { Category, ProblemWithCategories } from "./types";
import type { ProblemAttempts } from "./attemptExport";
import { GRADE_POINTS } from "./utils";

export type TopicStats = {
  id: string;
  name: string;
  questions: number;
  attempted: number;
  attempts: number;
  graded: number;
  points: number;
  average: number | null;
  toReview: number;
};

export function topicFocus(topic: TopicStats) {
  if (!topic.attempted) return "Not practiced";
  if (topic.average === null) return "No grade yet";
  if (topic.average < 2.5) return "Needs practice";
  if (topic.toReview) return "Review flagged";
  return "Keep practicing";
}

// Weak evidence first, then coverage gaps, flagged reviews, and stronger topics.
const priority = (row: TopicStats) =>
  row.average !== null && row.average < 2.5
    ? 0
    : !row.attempted || row.average === null
      ? 1
      : row.toReview
        ? 2
        : 3;

export function buildTopicStats(categories: Category[], problems: ProblemWithCategories[]) {
  const rows = new Map<string, TopicStats>();
  const add = (id: string, name: string) => {
    const row: TopicStats = {
      id,
      name,
      questions: 0,
      attempted: 0,
      attempts: 0,
      graded: 0,
      points: 0,
      average: null,
      toReview: 0,
    };
    rows.set(id, row);
    return row;
  };
  for (const category of categories) add(category._id, category.name);
  for (const problem of problems) {
    const ids = [...new Set(problem.categoryIds)].filter((id) => rows.has(id));
    const targets = ids.length ? ids : ["uncategorized"];
    for (const id of targets) {
      const row = rows.get(id) ?? add(id, "Uncategorized");
      row.questions++;
      row.attempts += problem.attemptCount;
      if (problem.attemptCount > 0) {
        row.attempted++;
        if (problem.latestGrade) {
          row.graded++;
          row.points += GRADE_POINTS[problem.latestGrade];
        }
      }
      if (problem.latestShouldReview) row.toReview++;
    }
  }
  for (const row of rows.values()) row.average = row.graded ? row.points / row.graded : null;
  return [...rows.values()].sort(
    (a, b) =>
      priority(a) - priority(b) ||
      (a.average ?? -1) - (b.average ?? -1) ||
      a.attempted - b.attempted ||
      a.name.localeCompare(b.name),
  );
}

const escape = (value: string | number) => {
  const text = String(value);
  // Keep custom category names from becoming spreadsheet formulas.
  const safe = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
};

export function topicsCsv(rows: TopicStats[], histories: ProblemAttempts[] = []) {
  const problemHeader = [
    "Problem",
    "Problem URL",
    "Difficulty",
    "Topics",
    "Latest grade",
    "Total attempts",
    ...Array.from({ length: 5 }, (_, index) => [
      `Attempt grade ${index + 1}`,
      `Review again ${index + 1}`,
      `Attempt notes ${index + 1}`,
    ]).flat(),
  ];
  const contents: (string | number)[][] = [
    ["Topic", "Questions attempted", "Total attempts", "Average latest grade (0-4)"],
    ...rows.map((row) => [row.name, row.attempted, row.attempts, row.average?.toFixed(2) ?? "NA"]),
    [],
    problemHeader,
    ...histories
      .filter(({ attempts }) => attempts.length > 0)
      .map(({ problem, attempts }) => {
        const row: (string | number)[] = [
          problem.name,
          problem.url,
          problem.difficulty,
          problem.categories.map((category) => category.name).join("; ") || "Uncategorized",
          attempts[0]?.grade ?? "NA",
          problem.attemptCount,
        ];
        row.push(
          ...Array.from({ length: 5 }, (_, index) => {
            const attempt = attempts[index];
            return [
              attempt?.grade ?? "NA",
              attempt ? (attempt.shouldReviewAgain ? "Yes" : "No") : "NA",
              attempt?.notes || "NA",
            ];
          }).flat(),
        );
        return row;
      }),
  ];
  // Two clearly separated tables, with blank trailing cells for CSV readers.
  return (
    contents
      .map((row) =>
        row
          .concat(Array<string>(problemHeader.length - row.length).fill(""))
          .map(escape)
          .join(","),
      )
      .join("\r\n") + "\r\n"
  );
}

export function downloadTopicsCsv(rows: TopicStats[], histories: ProblemAttempts[] = []) {
  const now = new Date();
  const url = URL.createObjectURL(
    new Blob(["\uFEFF", topicsCsv(rows, histories)], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `recall-topics-${now.toISOString().slice(0, 10)}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
