import { useRef, useState } from "react";
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
  const [savedDate, setSavedDate] = useState(problem.reviewDate);
  if (savedDate !== problem.reviewDate) {
    setSavedDate(problem.reviewDate);
    setDate(problem.reviewDate ?? "");
  }
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ message: string; reviewDate: string | null }>();
  const [message, setMessage] = useState("");
  const inFlight = useRef(false);
  const submit = async (reviewDate: string | null) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(undefined);
    setMessage("");
    try {
      await save({ problemId: problem._id, reviewDate });
      setDate(reviewDate ?? "");
      setMessage(reviewDate ? "Review scheduled." : "Review date cleared.");
    } catch (caught) {
      setError({ message: getErrorMessage(caught), reviewDate });
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };
  return (
    <div>
      <fieldset disabled={pending} className="flex flex-wrap items-end gap-3">
        <label className="field">
          <span>Review date</span>
          <input
            type="date"
            required
            max="9999-12-31"
            value={date}
            onChange={(event) => {
              const value = event.target.value;
              setDate(value);
              if (value && event.target.validity.valid) void submit(value);
            }}
            onBlur={(event) => {
              if (date && date !== problem.reviewDate && !error && event.target.validity.valid) {
                void submit(date);
              }
            }}
          />
        </label>
        {problem.reviewDate && (
          <button className="button-secondary" type="button" onClick={() => void submit(null)}>
            Clear date
          </button>
        )}
      </fieldset>
      {error && (
        <p role="alert" className="form-error mt-3">
          {error.message}{" "}
          <button
            type="button"
            className="underline"
            disabled={pending}
            onClick={() => void submit(error.reviewDate)}
          >
            Retry
          </button>
        </p>
      )}
      {(pending || message) && (
        <p role="status" className="mt-3 text-sm text-muted">
          {pending ? "Saving…" : message}
        </p>
      )}
    </div>
  );
}
