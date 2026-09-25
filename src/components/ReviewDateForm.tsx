import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { ProblemWithCategories } from "../lib/types";
import { getErrorMessage } from "../lib/utils";

export function ReviewDateForm({
  problem,
  initialDate = "",
}: {
  problem: ProblemWithCategories;
  initialDate?: string;
}) {
  const save = useMutation(api.problems.setReviewDate);
  const [date, setDate] = useState(problem.reviewDate ?? initialDate);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const submit = async (reviewDate: string | null) => {
    if (pending) return;
    setPending(true);
    setError("");
    setMessage("");
    try {
      await save({ problemId: problem._id, reviewDate });
      setDate(reviewDate ?? "");
      setMessage(reviewDate ? "Review scheduled." : "Review date cleared.");
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setPending(false);
    }
  };
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit(date);
      }}
    >
      <fieldset disabled={pending} className="flex flex-wrap items-end gap-3">
        <label className="field">
          <span>Review date</span>
          <input
            type="date"
            required
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <button className="button-primary" type="submit">
          {pending ? "Saving…" : "Save date"}
        </button>
        {problem.reviewDate && (
          <button className="button-secondary" type="button" onClick={() => void submit(null)}>
            Clear date
          </button>
        )}
      </fieldset>
      {error && (
        <p role="alert" className="form-error mt-3">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mt-3 text-sm text-muted">
          {message}
        </p>
      )}
    </form>
  );
}
