import type { Attempt, ProblemId, ProblemWithCategories } from "./types";

export type ProblemAttempts = { problem: ProblemWithCategories; attempts: Attempt[] };
export type ExportPeriod = "all" | "month" | "year" | "custom";
export type AttemptRange = { start: number; end: number };
export type FetchAttemptPage = (
  problemId: ProblemId,
  cursor: string | null,
  count: number,
) => Promise<{ page: Attempt[]; isDone: boolean; continueCursor: string }>;

// Local calendar dates, including the entire final day (also across DST changes).
export function exportRange(
  period: ExportPeriod,
  from = "",
  to = "",
  now = new Date(),
): AttemptRange {
  if (period === "all") return { start: -Infinity, end: Infinity };
  if (period === "custom") {
    const start = new Date(`${from}T00:00:00`);
    const end = new Date(`${to}T00:00:00`);
    if (!from || !to || !Number.isFinite(+start) || !Number.isFinite(+end) || start > end) {
      throw new Error("Choose a valid start and end date.");
    }
    end.setDate(end.getDate() + 1);
    return { start: +start, end: +end };
  }
  const start = new Date(now);
  start.setDate(start.getDate() - (period === "month" ? 30 : 365));
  return { start: +start, end: +now + 1 };
}

// The existing endpoint orders by attemptedAt descending. Scan every matching
// attempt for accurate totals, but retain only the five newest notes in memory.
export async function loadExportAttempts(
  problems: ProblemWithCategories[],
  fetchPage: FetchAttemptPage,
  range: AttemptRange = { start: -Infinity, end: Infinity },
): Promise<ProblemAttempts[]> {
  const result: ProblemAttempts[] = [];
  for (const problem of problems) {
    const attempts: Attempt[] = [];
    let count = 0;
    let cursor: string | null = null;
    let beforeRange = false;
    do {
      const page = await fetchPage(problem._id, cursor, 100);
      for (const attempt of page.page) {
        if (attempt.attemptedAt < range.start) {
          beforeRange = true;
          break;
        }
        if (attempt.attemptedAt >= range.end) continue;
        count++;
        if (attempts.length < 5) attempts.push(attempt);
      }
      if (page.isDone || beforeRange) break;
      if (page.continueCursor === cursor)
        throw new Error("Attempt history could not be loaded. Please retry.");
      cursor = page.continueCursor;
    } while (!beforeRange);
    const latest = attempts[0];
    if (latest)
      result.push({
        problem: {
          ...problem,
          attemptCount: count,
          latestGrade: latest.grade,
          latestAttemptAt: latest.attemptedAt,
          latestShouldReview: latest.shouldReviewAgain,
        },
        attempts,
      });
  }
  return result;
}
