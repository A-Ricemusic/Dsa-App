import type { Grade, ProblemWithCategories, SortKey } from "./types";

export const GRADE_POINTS: Record<Grade, number> = {
  A: 4,
  B: 3,
  C: 2,
  D: 1,
  F: 0,
};

export function formatDate(timestamp?: number) {
  if (!timestamp) return "Not attempted";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(timestamp);
}

export function formatShortDate(timestamp?: number) {
  if (!timestamp) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(timestamp);
}

export function dateInputValue(timestamp = Date.now()) {
  const date = new Date(timestamp);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function inputDateTimestamp(value: string) {
  return new Date(`${value}T12:00:00`).getTime();
}

export function averageGrade(problems: ProblemWithCategories[]) {
  const graded = problems.filter((problem) => problem.latestGrade);
  if (graded.length === 0) return "—";
  const total = graded.reduce((sum, problem) => sum + GRADE_POINTS[problem.latestGrade!], 0);
  const average = total / graded.length;
  if (average >= 3.5) return "A";
  if (average >= 2.5) return "B";
  if (average >= 1.5) return "C";
  if (average >= 0.5) return "D";
  return "F";
}

export function averageGradeFromCounts(counts: Record<Grade, number>) {
  const graded = Object.values(counts).reduce((sum, count) => sum + count, 0);
  if (graded === 0) return "—";
  const total = (Object.entries(counts) as [Grade, number][]).reduce(
    (sum, [grade, count]) => sum + GRADE_POINTS[grade] * count,
    0,
  );
  const average = total / graded;
  if (average >= 3.5) return "A";
  if (average >= 2.5) return "B";
  if (average >= 1.5) return "C";
  if (average >= 0.5) return "D";
  return "F";
}

export function sortProblems(problems: ProblemWithCategories[], sort: SortKey) {
  return [...problems].sort((a, b) => {
    if (sort === "attempts") return b.attemptCount - a.attemptCount;
    if (sort === "grade") {
      const aGrade = a.latestGrade ? GRADE_POINTS[a.latestGrade] : -1;
      const bGrade = b.latestGrade ? GRADE_POINTS[b.latestGrade] : -1;
      return bGrade - aGrade;
    }
    if (sort === "name") return a.name.localeCompare(b.name);
    return (b.latestAttemptAt ?? b.createdAt) - (a.latestAttemptAt ?? a.createdAt);
  });
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    const marker = "Uncaught ConvexError: ";
    const clean = error.message.includes(marker)
      ? error.message.split(marker)[1]?.split("\n")[0]
      : error.message;
    return clean ?? "Something went wrong.";
  }
  return "Something went wrong.";
}
