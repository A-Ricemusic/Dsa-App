import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Attempt, Grade, ProblemWithCategories } from "../lib/types";
import {
  dateInputValue,
  formatDate,
  getErrorMessage,
  inputDateTimestamp,
} from "../lib/utils";
import { DifficultyBadge, GradeBadge, Modal, Spinner, Toggle } from "./Primitives";

export function ProblemDetail({
  problem,
  onClose,
  onEdit,
  onDelete,
}: {
  problem?: ProblemWithCategories;
  onClose: () => void;
  onEdit: (problem: ProblemWithCategories) => void;
  onDelete: (problem: ProblemWithCategories) => Promise<void>;
}) {
  const attempts = useQuery(
    api.attempts.listForProblem,
    problem ? { problemId: problem._id } : "skip",
  );
  const createAttempt = useMutation(api.attempts.create);
  const updateAttempt = useMutation(api.attempts.update);
  const removeAttempt = useMutation(api.attempts.remove);
  const [editing, setEditing] = useState<Attempt>();
  const [date, setDate] = useState(dateInputValue());
  const [grade, setGrade] = useState<Grade>("B");
  const [shouldReview, setShouldReview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const resetForm = () => {
    setEditing(undefined);
    setDate(dateInputValue());
    setGrade("B");
    setShouldReview(false);
    setError("");
  };

  useEffect(() => {
    if (!problem) resetForm();
  }, [problem]);

  const startEditing = (attempt: Attempt) => {
    setEditing(attempt);
    setDate(dateInputValue(attempt.attemptedAt));
    setGrade(attempt.grade);
    setShouldReview(attempt.shouldReviewAgain);
    setError("");
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!problem) return;
    setSaving(true);
    setError("");
    try {
      const values = {
        attemptedAt: inputDateTimestamp(date),
        grade,
        shouldReviewAgain: shouldReview,
      };
      if (editing) await updateAttempt({ attemptId: editing._id, ...values });
      else await createAttempt({ problemId: problem._id, ...values });
      resetForm();
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAttempt = async (attempt: Attempt) => {
    if (!window.confirm("Delete this attempt? This cannot be undone.")) return;
    try {
      await removeAttempt({ attemptId: attempt._id });
      if (editing?._id === attempt._id) resetForm();
    } catch (caught) {
      setError(getErrorMessage(caught));
    }
  };

  const handleDeleteProblem = async () => {
    if (!problem) return;
    if (!window.confirm(`Delete “${problem.name}” and all of its attempts?`)) return;
    setDeleting(true);
    try {
      await onDelete(problem);
      onClose();
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal
      open={Boolean(problem)}
      onClose={onClose}
      eyebrow="Problem journal"
      title={problem?.name ?? "Problem"}
      width="max-w-4xl"
    >
      {problem && (
        <div className="grid lg:grid-cols-[minmax(0,1fr)_23rem]">
          <div className="border-b border-line px-6 py-7 sm:px-8 lg:border-b-0 lg:border-r">
            <div className="flex flex-wrap items-center gap-2">
              <DifficultyBadge difficulty={problem.difficulty} />
              {problem.categories.map((category) => (
                <span className="tag" key={category._id}>
                  {category.name}
                </span>
              ))}
            </div>

            <div className="mt-7 grid grid-cols-3 gap-3">
              <div className="mini-stat">
                <span>Latest grade</span>
                <GradeBadge grade={problem.latestGrade} />
              </div>
              <div className="mini-stat">
                <span>Attempts</span>
                <strong>{problem.attemptCount}</strong>
              </div>
              <div className="mini-stat">
                <span>Last tried</span>
                <strong className="text-xs">{formatDate(problem.latestAttemptAt)}</strong>
              </div>
            </div>

            <div className="mt-8">
              <p className="eyebrow">Notes to future me</p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-ink/75">
                {problem.thoughts || "No overall thoughts yet."}
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <a className="button-secondary" href={problem.url} target="_blank" rel="noreferrer">
                Open problem <ExternalLink size={15} />
              </a>
              <button className="button-secondary" onClick={() => onEdit(problem)}>
                <Pencil size={15} /> Edit details
              </button>
              <button
                className="button-danger"
                onClick={() => void handleDeleteProblem()}
                disabled={deleting}
              >
                <Trash2 size={15} /> {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>

            <div className="mt-10 border-t border-line pt-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="eyebrow">Attempt history</p>
                  <h3 className="mt-1 font-display text-2xl text-ink">Your repetitions</h3>
                </div>
                <span className="rounded-full bg-mist px-3 py-1 text-xs font-semibold text-muted">
                  {attempts?.length ?? 0} logged
                </span>
              </div>

              <div className="mt-5 space-y-3">
                {attempts === undefined ? (
                  <Spinner label="Loading attempts" />
                ) : attempts.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-stone px-5 py-8 text-center text-sm text-muted">
                    No attempts yet. Log the first one using the form.
                  </div>
                ) : (
                  attempts.map((attempt, index) => (
                    <article
                      key={attempt._id}
                      className="group flex items-center gap-4 rounded-2xl border border-line p-4 transition hover:border-stone"
                    >
                      <GradeBadge grade={attempt.grade} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-ink">
                          Attempt {attempts.length - index}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                          <CalendarDays size={13} /> {formatDate(attempt.attemptedAt)}
                        </p>
                      </div>
                      <div className="hidden sm:block">
                        {attempt.shouldReviewAgain ? (
                          <span className="review-pill">
                            <RotateCcw size={12} /> Review again
                          </span>
                        ) : (
                          <span className="mastered-pill">
                            <CheckCircle2 size={12} /> Feeling solid
                          </span>
                        )}
                      </div>
                      <button
                        className="icon-button opacity-70 sm:opacity-0 sm:group-hover:opacity-100"
                        onClick={() => startEditing(attempt)}
                        aria-label="Edit attempt"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        className="icon-button text-danger opacity-70 sm:opacity-0 sm:group-hover:opacity-100"
                        onClick={() => void handleRemoveAttempt(attempt)}
                        aria-label="Delete attempt"
                      >
                        <Trash2 size={15} />
                      </button>
                    </article>
                  ))
                )}
              </div>
            </div>
          </div>

          <aside className="bg-canvas/65 px-6 py-7 sm:px-8">
            <div className="sticky top-24">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-xl bg-accent text-white">
                  {editing ? <Pencil size={18} /> : <Plus size={19} />}
                </div>
                <div>
                  <p className="text-sm font-bold text-ink">
                    {editing ? "Edit attempt" : "Log an attempt"}
                  </p>
                  <p className="text-xs text-muted">Keep the signal honest.</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                <label className="field">
                  <span>Date attempted</span>
                  <input
                    required
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                  />
                </label>

                <fieldset>
                  <legend className="field-label">How did it go?</legend>
                  <div className="mt-2 grid grid-cols-5 gap-2">
                    {(["A", "B", "C", "D", "F"] as const).map((value) => (
                      <button
                        type="button"
                        key={value}
                        onClick={() => setGrade(value)}
                        className={`grade-choice ${grade === value ? "grade-choice-active" : ""}`}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <Toggle
                  checked={shouldReview}
                  onChange={setShouldReview}
                  label="Review this again"
                  description="Only the newest attempt controls the review queue."
                />

                {error && <p className="form-error">{error}</p>}

                <button type="submit" className="button-primary w-full" disabled={saving}>
                  {saving ? "Saving…" : editing ? "Save attempt" : "Log attempt"}
                </button>
                {editing && (
                  <button type="button" className="button-ghost w-full" onClick={resetForm}>
                    Cancel editing
                  </button>
                )}
              </form>
            </div>
          </aside>
        </div>
      )}
    </Modal>
  );
}
