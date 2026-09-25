import { useCompleteQuery } from "../lib/useCompleteQuery";
import { useState } from "react";
import { useMutation } from "convex/react";
import { ArrowLeft, CalendarDays, ExternalLink, Pencil, RefreshCcw, Trash2 } from "lucide-react";
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
  const attempts = useCompleteQuery(api.attempts.listForProblemPage, { problemId: problem._id });
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

      <header className="detail-heading">
        <div>
          <p className="eyebrow">Attempt {attemptNumber}</p>
          <h1 className="mt-2">{problem.name}</h1>
          <p className="mt-4 flex items-center gap-2 text-sm text-muted">
            <CalendarDays size={15} /> {formatDate(attempt.attemptedAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button className="button-primary" onClick={() => setEditing(true)}>
            <Pencil size={15} /> Edit attempt
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
          <dt>Grade</dt>
          <dd>
            <GradeBadge grade={attempt.grade} />
          </dd>
        </div>
        <div>
          <dt>Review status</dt>
          <dd>
            {attempt.shouldReviewAgain ? (
              <span className="flex items-center gap-2 text-review-light">
                <RefreshCcw size={14} />
                Review again
              </span>
            ) : (
              "No review needed"
            )}
          </dd>
        </div>
        <div>
          <dt>Attempt</dt>
          <dd>
            {attemptNumber} of {attempts.length}
          </dd>
        </div>
      </dl>
      <div className="notes-layout">
        <article>
          <h2 className="mb-4 text-base">Attempt notes</h2>
          <div className="notes-content">{notes || "No notes were added for this attempt."}</div>
        </article>
        <aside className="notes-aside">
          <h2 className="mb-4 text-sm">Problem details</h2>
          <DifficultyBadge difficulty={problem.difficulty} />
          <div className="mt-3 flex flex-wrap gap-2">
            {problem.categories.map((category) => (
              <span className="tag" key={category._id}>
                {category.name}
              </span>
            ))}
          </div>
          <a className="text-button mt-5" href={problem.url} target="_blank" rel="noreferrer">
            Open problem <ExternalLink size={14} />
          </a>
        </aside>
      </div>

      <AttemptForm
        open={editing}
        onClose={() => setEditing(false)}
        problemId={problem._id}
        initialReviewDate={problem.reviewDate}
        attempt={attempt}
        initialNotes={notes}
      />
    </div>
  );
}
