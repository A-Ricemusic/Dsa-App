import { useCompleteQuery } from "../lib/useCompleteQuery";
import { useState } from "react";

import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ExternalLink,
  Pencil,
  Plus,
  RefreshCcw,
  Trash2,
} from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Attempt, ProblemWithCategories } from "../lib/types";
import { formatDate, getErrorMessage } from "../lib/utils";
import { ReviewDateForm } from "./ReviewDateForm";
import { AttemptForm } from "./AttemptForm";
import { DifficultyBadge, EmptyState, GradeBadge, Spinner } from "./Primitives";

export function ProblemPage({
  problem,
  onBack,
  onOpenAttempt,
  onEdit,
  onDelete,
}: {
  problem: ProblemWithCategories;
  onBack: () => void;
  onOpenAttempt: (attempt: Attempt) => void;
  onEdit: () => void;
  onDelete: () => Promise<void>;
}) {
  const attempts = useCompleteQuery(api.attempts.listForProblemPage, { problemId: problem._id });
  const [attemptFormOpen, setAttemptFormOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    if (!window.confirm(`Delete “${problem.name}” and all of its attempts?`)) return;
    setDeleting(true);
    setError("");
    try {
      await onDelete();
    } catch (caught) {
      setError(getErrorMessage(caught));
      setDeleting(false);
    }
  };

  return (
    <div className="page-wrap">
      <button className="text-button" onClick={onBack}>
        <ArrowLeft size={15} /> Back to problems
      </button>

      <header className="detail-heading">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <DifficultyBadge difficulty={problem.difficulty} />
            {problem.categories.map((category) => (
              <span className="tag" key={category._id}>
                {category.name}
              </span>
            ))}
          </div>

          <h1 className="max-w-4xl">{problem.name}</h1>
          <a
            className="mt-4 inline-flex max-w-full items-center gap-2 truncate text-sm font-semibold text-accent hover:text-accent-ink"
            href={problem.url}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={15} className="shrink-0" />
            <span className="truncate">{problem.url}</span>
          </a>
        </div>

        <div className="detail-actions">
          <button className="button-primary" onClick={() => setAttemptFormOpen(true)}>
            <Plus size={16} /> Log attempt
          </button>
          <button className="button-secondary" onClick={onEdit}>
            <Pencil size={15} /> Edit problem
          </button>
          <button
            className="button-ghost text-danger"
            onClick={() => void handleDelete()}
            disabled={deleting}
          >
            <Trash2 size={15} /> {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </header>

      {error && (
        <p role="alert" className="form-error mt-6">
          {error}
        </p>
      )}

      <dl className="detail-stats">
        <div>
          <dt>Latest grade</dt>
          <dd>
            <GradeBadge grade={problem.latestGrade} />
          </dd>
        </div>
        <div>
          <dt>Total attempts</dt>
          <dd>{problem.attemptCount}</dd>
        </div>
        <div>
          <dt>Last practiced</dt>
          <dd>{formatDate(problem.latestAttemptAt)}</dd>
        </div>
        {problem.latestShouldReview && (
          <div>
            <dt>Next step</dt>
            <dd className="flex items-center gap-2 text-review-light">
              <RefreshCcw size={14} />
              Review again
            </dd>
          </div>
        )}
      </dl>

      <section className="panel mt-6 p-5" aria-label="Review schedule">
        <h2 className="mb-2 text-base">Next review</h2>
        <p className="mb-4 text-sm text-muted">
          Choose a day on your calendar. After practicing, clear the date or schedule your next
          review.
        </p>
        <ReviewDateForm key={`${problem._id}:${problem.reviewDate}`} problem={problem} />
      </section>

      <section className="mt-6">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-base">Attempt history</h2>
          </div>
          <span className="rounded-full bg-mist px-3 py-1 text-xs font-semibold text-muted">
            {problem.attemptCount} logged
          </span>
        </div>

        {attempts === undefined ? (
          <div className="panel grid min-h-64 place-items-center">
            <Spinner label="Loading attempts" />
          </div>
        ) : attempts.length === 0 ? (
          <EmptyState
            title="No attempts yet"
            description="This problem is in your library, ready for whenever you take the first pass."
            action={
              <button className="button-primary" onClick={() => setAttemptFormOpen(true)}>
                <Plus size={16} /> Log the first attempt
              </button>
            }
          />
        ) : (
          <div className="border-t border-line">
            {attempts.map((attempt, index) => {
              const notes = attempt.notes;
              return (
                <button
                  key={attempt._id}
                  onClick={() => onOpenAttempt(attempt)}
                  className="group attempt-row"
                >
                  <GradeBadge grade={attempt.grade} />
                  <div>
                    <p className="text-sm font-bold text-ink">Attempt {attempts.length - index}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                      <CalendarDays size={13} /> {formatDate(attempt.attemptedAt)}
                    </p>
                  </div>
                  <div className="attempt-preview order-last min-w-0 md:order-none">
                    <p className="line-clamp-2 text-sm leading-6 text-muted">
                      {notes || "No notes were added for this attempt."}
                    </p>
                  </div>
                  <div className="flex items-center justify-end gap-3">
                    {attempt.shouldReviewAgain ? (
                      <span className="review-pill">
                        <RefreshCcw size={11} /> Review again
                      </span>
                    ) : (
                      <span className="mastered-pill">Feeling solid</span>
                    )}
                    <ArrowRight
                      size={16}
                      className="text-stone transition group-hover:translate-x-0.5 group-hover:text-accent"
                    />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <AttemptForm
        open={attemptFormOpen}
        onClose={() => setAttemptFormOpen(false)}
        problemId={problem._id}
      />
    </div>
  );
}
