import { ArrowRight, Plus, RefreshCcw } from "lucide-react";
import type { Grade, ProblemWithCategories } from "../lib/types";
import { averageGrade, sortProblems } from "../lib/utils";
import { EmptyState, GradeBadge } from "./Primitives";
import { ProblemList } from "./ProblemList";

export function Dashboard({
  problems,
  firstName,
  onAddProblem,
  onOpenProblem,
  onSeeAll,
}: {
  problems: ProblemWithCategories[];
  firstName: string;
  onAddProblem: () => void;
  onOpenProblem: (problem: ProblemWithCategories) => void;
  onSeeAll: (reviewOnly?: boolean) => void;
}) {
  const reviewQueue = sortProblems(
    problems.filter((problem) => problem.latestShouldReview),
    "recent",
  );
  const recent = sortProblems(problems, "recent").slice(0, 6);
  const attempts = problems.reduce((sum, problem) => sum + problem.attemptCount, 0);
  const gradedCount = problems.filter((problem) => problem.latestGrade).length;
  const counts = (["A", "B", "C", "D", "F"] as Grade[]).map((grade) => ({
    grade,
    count: problems.filter((problem) => problem.latestGrade === grade).length,
  }));

  return (
    <div className="page-wrap">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Your practice, at a glance</p>
          <h1>Overview</h1>
          <p className="page-description">Welcome back, {firstName}. Pick up where you left off.</p>
        </div>
        <button className="button-primary" onClick={onAddProblem}>
          <Plus size={16} />
          Add problem
        </button>
      </div>
      <dl className="stats-strip">
        <div>
          <dt>Problems</dt>
          <dd>{problems.length}</dd>
        </div>
        <div>
          <dt>Total attempts</dt>
          <dd>{attempts}</dd>
        </div>
        <div>
          <dt>Average grade</dt>
          <dd>{averageGrade(problems) ?? "—"}</dd>
        </div>
        <div>
          <dt>To review</dt>
          <dd className={reviewQueue.length ? "text-review-light" : ""}>{reviewQueue.length}</dd>
        </div>
      </dl>
      {problems.length === 0 ? (
        <EmptyState
          title="Your practice starts here"
          description="Add a problem, record an attempt, and keep what you learned in one place."
          action={
            <button className="button-primary" onClick={onAddProblem}>
              <Plus size={16} />
              Add your first problem
            </button>
          }
        />
      ) : (
        <>
          <div className="overview-focus">
            <section aria-labelledby="review-heading">
              <div className="section-heading">
                <h2 id="review-heading">
                  <RefreshCcw size={16} />
                  Next to review <span className="count-label">{reviewQueue.length}</span>
                </h2>
                {reviewQueue[0] && (
                  <button className="text-button" onClick={() => onOpenProblem(reviewQueue[0]!)}>
                    Start review <ArrowRight size={14} />
                  </button>
                )}
              </div>
              {reviewQueue.length ? (
                <ul className="review-list">
                  {reviewQueue.slice(0, 3).map((problem) => (
                    <li key={problem._id}>
                      <button onClick={() => onOpenProblem(problem)}>
                        <GradeBadge grade={problem.latestGrade} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{problem.name}</span>
                          <span className="mt-1 block truncate text-xs text-muted">
                            {problem.categories.map((category) => category.name).join(" · ") ||
                              "Uncategorized"}
                          </span>
                        </span>
                        <ArrowRight size={15} className="text-muted" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="quiet-message">
                  You’re all caught up. Mark an attempt for review to revisit it here.
                </p>
              )}
              {reviewQueue.length > 3 && (
                <button className="text-button mt-3" onClick={() => onSeeAll(true)}>
                  View all {reviewQueue.length} to review <ArrowRight size={14} />
                </button>
              )}
            </section>
            <section className="grade-summary" aria-labelledby="grades-heading">
              <div className="section-heading">
                <h2 id="grades-heading">Latest grades</h2>
                <span className="text-xs text-muted">{gradedCount} graded</span>
              </div>
              <div className="grade-distribution">
                {counts.map(({ grade, count }) => (
                  <div key={grade}>
                    <span className="text-xs font-medium">{grade}</span>
                    <div className="distribution-track">
                      <div style={{ width: `${gradedCount ? (count / gradedCount) * 100 : 0}%` }} />
                    </div>
                    <span className="text-xs tabular-nums text-muted">{count}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted">
                One grade per problem, from its latest attempt.
              </p>
            </section>
          </div>
          <section className="mt-9">
            <div className="section-heading">
              <h2>Recent practice</h2>
              <button className="text-button" onClick={() => onSeeAll()}>
                View all problems <ArrowRight size={14} />
              </button>
            </div>
            <ProblemList problems={recent} onOpenProblem={onOpenProblem} label="Recent practice" />
          </section>
        </>
      )}
    </div>
  );
}
