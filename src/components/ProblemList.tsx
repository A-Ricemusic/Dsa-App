import { ArrowUpRight, RefreshCcw } from "lucide-react";
import type { ProblemWithCategories } from "../lib/types";
import { formatShortDate } from "../lib/utils";
import { DifficultyBadge, GradeBadge } from "./Primitives";

export function ProblemList({
  problems,
  onOpenProblem,
  label = "Problems",
}: {
  problems: ProblemWithCategories[];
  onOpenProblem: (problem: ProblemWithCategories) => void;
  label?: string;
}) {
  return (
    <div className="problem-list">
      <table>
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr>
            <th scope="col">Problem</th>
            <th scope="col" className="difficulty-column">
              Difficulty
            </th>
            <th scope="col">Grade</th>
            <th scope="col" className="attempts-column">
              Attempts
            </th>
            <th scope="col" className="date-column">
              Last practiced
            </th>
            <th scope="col">
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {problems.map((problem) => (
            <tr key={problem._id}>
              <td>
                <button className="problem-link" onClick={() => onOpenProblem(problem)}>
                  {problem.name}
                </button>
                <p className="problem-topics">
                  {problem.categories.map((category) => category.name).join(" · ") ||
                    "Uncategorized"}
                </p>
                <div className="mobile-problem-meta">
                  <DifficultyBadge difficulty={problem.difficulty} />
                  <span>
                    {problem.attemptCount} {problem.attemptCount === 1 ? "attempt" : "attempts"}
                  </span>
                </div>
              </td>
              <td className="difficulty-column">
                <DifficultyBadge difficulty={problem.difficulty} />
              </td>
              <td>
                <div className="flex items-center gap-2">
                  <GradeBadge grade={problem.latestGrade} />
                  {problem.latestShouldReview && (
                    <span title="Review again">
                      <RefreshCcw size={13} className="text-review-light" />
                      <span className="sr-only">Review again</span>
                    </span>
                  )}
                </div>
              </td>
              <td className="attempts-column tabular-nums">{problem.attemptCount}</td>
              <td className="date-column text-muted">{formatShortDate(problem.latestAttemptAt)}</td>
              <td>
                <button
                  className="row-open"
                  onClick={() => onOpenProblem(problem)}
                  aria-label={`Open ${problem.name}`}
                >
                  <ArrowUpRight size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
