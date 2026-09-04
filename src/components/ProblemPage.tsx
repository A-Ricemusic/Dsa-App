import { useState } from "react";
import { useQuery } from "convex/react";
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
  const attempts = useQuery(api.attempts.listForProblem, { problemId: problem._id });
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

      <header className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <DifficultyBadge difficulty={problem.difficulty} />
            {problem.categories.map((category) => (
              <span className="tag" key={category._id}>
                {category.name}
              </span>
            ))}
          </div>
          <p className="eyebrow mt-6">Problem journal</p>
          <h1 className="mt-2 max-w-4xl font-display text-4xl leading-tight text-ink sm:text-5xl">
            {problem.name}
          </h1>
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

        <div className="flex flex-wrap gap-3">
          <button className="button-primary" onClick={() => setAttemptFormOpen(true)}>
            <Plus size={16} /> Log attempt
          </button>
          <button className="button-secondary" onClick={onEdit}>
            <Pencil size={15} /> Edit problem
          </button>
          <button className="button-danger" onClick={() => void handleDelete()} disabled={deleting}>
            <Trash2 size={15} /> {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </header>

      {error && <p className="form-error mt-6">{error}</p>}

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <article className="panel flex items-center gap-4 p-5">
          <GradeBadge grade={problem.latestGrade} large />
          <div>
            <p className="text-xs font-semibold text-muted">Latest grade</p>
            <p className="mt-1 text-sm font-bold text-ink">
              {problem.latestGrade ? `Grade ${problem.latestGrade}` : "Not attempted"}
            </p>
          </div>
        </article>
        <article className="panel p-5">
          <p className="text-xs font-semibold text-muted">Total attempts</p>
          <p className="mt-2 font-display text-3xl text-ink">{problem.attemptCount}</p>
        </article>
        <article className="panel p-5">
          <p className="text-xs font-semibold text-muted">Last practiced</p>
          <p className="mt-2 text-sm font-bold text-ink">{formatDate(problem.latestAttemptAt)}</p>
          {problem.latestShouldReview && (
            <span className="review-pill mt-2">
              <RefreshCcw size={11} /> Review again
            </span>
          )}
        </article>
      </section>

      <section className="mt-6">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Attempt history</p>
            <h2 className="mt-1 font-display text-3xl text-ink">Your repetitions</h2>
          </div>
          <span className="rounded-full bg-mist px-3 py-1 text-xs font-semibold text-muted">
            {attempts?.length ?? 0} logged
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
          <div className="grid gap-3">
            {attempts.map((attempt, index) => {
              const notes = attempt.notes;
              return (
                <button
                  key={attempt._id}
                  onClick={() => onOpenAttempt(attempt)}
                  className="group panel grid gap-4 p-5 text-left transition hover:-translate-y-0.5 hover:border-stone hover:shadow-soft sm:grid-cols-[auto_11rem_minmax(0,1fr)_auto] sm:items-center"
                >
                  <GradeBadge grade={attempt.grade} large />
                  <div>
                    <p className="text-sm font-bold text-ink">Attempt {attempts.length - index}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                      <CalendarDays size={13} /> {formatDate(attempt.attemptedAt)}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm leading-6 text-muted">
                      {notes || "No notes were added for this attempt."}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-4 sm:justify-end">
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
