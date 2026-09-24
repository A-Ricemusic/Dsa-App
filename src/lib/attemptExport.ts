import type { Attempt, ProblemId, ProblemWithCategories } from "./types";

export type ProblemAttempts = { problem: ProblemWithCategories; attempts: Attempt[] };
export type FetchAttemptPage = (
  problemId: ProblemId,
  cursor: string | null,
  count: number,
) => Promise<{ page: Attempt[]; isDone: boolean; continueCursor: string }>;

// Fetch only when exporting, with one bounded request in flight at a time.
export async function loadExportAttempts(
  problems: ProblemWithCategories[],
  fetchPage: FetchAttemptPage,
): Promise<ProblemAttempts[]> {
  const result: ProblemAttempts[] = [];
  for (const problem of problems) {
    const attempts: Attempt[] = [];
    let cursor: string | null = null;
    do {
      const page = await fetchPage(problem._id, cursor, 5 - attempts.length);
      attempts.push(...page.page.slice(0, 5 - attempts.length));
      if (page.isDone || attempts.length === 5) break;
      if (page.continueCursor === cursor)
        throw new Error("Attempt history could not be loaded. Please retry.");
      cursor = page.continueCursor;
    } while (attempts.length < 5);
    result.push({ problem, attempts });
  }
  return result;
}
