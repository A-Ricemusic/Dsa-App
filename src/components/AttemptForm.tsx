import { useEffect, useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Attempt, Grade, ProblemId } from "../lib/types";
import {
  dateInputValue,
  getErrorMessage,
  inputDateTimestamp,
} from "../lib/utils";
import { Modal, Toggle } from "./Primitives";

export function AttemptForm({
  open,
  onClose,
  problemId,
  attempt,
  initialNotes = "",
}: {
  open: boolean;
  onClose: () => void;
  problemId: ProblemId;
  attempt?: Attempt;
  initialNotes?: string;
}) {
  const createAttempt = useMutation(api.attempts.create);
  const updateAttempt = useMutation(api.attempts.update);
  const [attemptedAt, setAttemptedAt] = useState(dateInputValue());
  const [grade, setGrade] = useState<Grade>("B");
  const [shouldReviewAgain, setShouldReviewAgain] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setAttemptedAt(dateInputValue(attempt?.attemptedAt));
    setGrade(attempt?.grade ?? "B");
    setShouldReviewAgain(attempt?.shouldReviewAgain ?? false);
    setNotes(attempt?.notes ?? initialNotes);
    setError("");
  }, [attempt, initialNotes, open]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    const values = {
      attemptedAt: inputDateTimestamp(attemptedAt),
      grade,
      shouldReviewAgain,
      notes,
    };

    try {
      if (attempt) await updateAttempt({ attemptId: attempt._id, ...values });
      else await createAttempt({ problemId, ...values });
      onClose();
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow={attempt ? "Update your reflection" : "Another repetition"}
      title={attempt ? "Edit attempt" : "Log an attempt"}
    >
      <form onSubmit={handleSubmit} className="space-y-6 px-6 py-7 sm:px-8">
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="field">
            <span>Date attempted</span>
            <input
              required
              type="date"
              value={attemptedAt}
              onChange={(event) => setAttemptedAt(event.target.value)}
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
        </div>

        <Toggle
          checked={shouldReviewAgain}
          onChange={setShouldReviewAgain}
          label="Review this again"
          description="Only the newest attempt controls whether the problem enters your review queue."
        />

        <label className="field">
          <span>Attempt notes</span>
          <textarea
            rows={7}
            maxLength={4000}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="What clicked? What tripped you up? Leave context for your future self."
          />
          <small>{notes.length}/4,000</small>
        </label>

        {error && <p className="form-error">{error}</p>}

        <div className="flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:justify-end">
          <button type="button" className="button-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button-primary" disabled={saving}>
            {saving ? "Saving…" : attempt ? "Save attempt" : "Log attempt"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
