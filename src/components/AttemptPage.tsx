import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  CalendarDays,
  ExternalLink,
  Pencil,
  RefreshCcw,
  Trash2,
} from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { AttemptId, ProblemWithCategories } from "../lib/types";
import { formatDate, getErrorMessage } from "../lib/utils";
import { AttemptForm } from "./AttemptForm";
import { DifficultyBadge, GradeBadge, Spinner } from "./Primitives";

export function AttemptPage({
  problem,
  attemptId,
  onBack,
  onDeleted,
}: {
  problem: ProblemWithCategories;
  attemptId: AttemptId;
  onBack: () => void;
  onDeleted: () => void;
}) {
  const attempts = useQuery(api.attempts.listForProblem, { problemId: problem._id });
  const removeAttempt = useMutation(api.attempts.remove);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  if (attempts === undefined) {
    return (
      <div className="grid min-h-[80vh] place-items-center">
        <Spinner label="Opening attempt" />
      </div>
    );
  }

  const index = attempts.findIndex((attempt) => attempt._id === attemptId);
  const attempt = attempts[index];
  if (!attempt) {
    return (
      <div className="page-wrap">
        <section className="panel mx-auto max-w-xl p-8 text-center sm:p-10">
          <p className="eyebrow">Attempt not found</p>
          <h1 className="mt-2 font-display text-3xl text-ink">This attempt is unavailable.</h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            It may have been deleted, or the link may no longer be valid.
          </p>
          <button className="button-primary mt-7" onClick={onBack}>
            <ArrowLeft size={15} /> Back to problem
          </button>
        </section>
      </div>
    );
  }

  const attemptNumber = attempts.length - index;
  const notes = attempt.notes;

  const handleDelete = async () => {
    if (!window.confirm("Delete this attempt? This cannot be undone.")) return;
    setDeleting(true);
    setError("");
    try {
      await removeAttempt({ attemptId: attempt._id });
      onDeleted();
    } catch (caught) {
      setError(getErrorMessage(caught));
      setDeleting(false);
    }
  };

  return (
    <div className="page-wrap">
      <button className="text-button" onClick={onBack}>
        <ArrowLeft size={15} /> Back to {problem.name}
      </button>

      <header className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Attempt {attemptNumber}</p>
          <h1 className="mt-2 font-display text-4xl text-ink sm:text-5xl">{problem.name}</h1>
          <p className="mt-4 flex items-center gap-2 text-sm text-muted">
            <CalendarDays size={15} /> {formatDate(attempt.attemptedAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button className="button-primary" onClick={() => setEditing(true)}>
            <Pencil size={15} /> Edit attempt
          </button>
          <button
            className="button-danger"
            onClick={() => void handleDelete()}
            disabled={deleting}
          >
            <Trash2 size={15} /> {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </header>

      {error && <p className="form-error mt-6">{error}</p>}

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_22rem]">
        <article className="panel p-6 sm:p-8 lg:p-10">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-7">
            <div className="flex items-center gap-4">
              <GradeBadge grade={attempt.grade} large />
              <div>
                <p className="text-xs font-semibold text-muted">Performance</p>
                <p className="mt-1 text-lg font-bold text-ink">Grade {attempt.grade}</p>
              </div>
            </div>
            {attempt.shouldReviewAgain ? (
              <span className="review-pill"><RefreshCcw size={12} /> Review again</span>
            ) : (
              <span className="mastered-pill">Feeling solid</span>
            )}
          </div>

          <div className="pt-8">
            <p className="eyebrow">Notes to future me</p>
            <div className="mt-4 min-h-52 whitespace-pre-wrap text-base leading-8 text-ink/80">
              {notes || "No notes were added for this attempt."}
            </div>
          </div>
        </article>

        <aside className="space-y-4">
          <section className="panel p-6">
            <p className="eyebrow">Problem details</p>
            <h2 className="mt-2 font-display text-2xl text-ink">{problem.name}</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              <DifficultyBadge difficulty={problem.difficulty} />
              {problem.categories.map((category) => (
                <span className="tag" key={category._id}>{category.name}</span>
              ))}
            </div>
            <a
              className="button-secondary mt-6 w-full"
              href={problem.url}
              target="_blank"
              rel="noreferrer"
            >
              Open problem <ExternalLink size={15} />
            </a>
          </section>

          <section className="rounded-[1.75rem] bg-review p-6 text-white shadow-soft">
            <p className="text-xs font-semibold text-white/60">Practice context</p>
            <p className="mt-3 font-display text-3xl">{attemptNumber} of {attempts.length}</p>
            <p className="mt-2 text-sm leading-6 text-white/65">
              Every attempt keeps its own grade, review decision, and reflection.
            </p>
          </section>
        </aside>
      </div>

      <AttemptForm
        open={editing}
        onClose={() => setEditing(false)}
        problemId={problem._id}
        attempt={attempt}
        initialNotes={notes}
      />
    </div>
  );
}
