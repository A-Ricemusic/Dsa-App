import { useFormRequest } from "../lib/useFormRequest";
import { useEffect, useRef, useMemo, useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { Check, Plus, Search, Tag, X } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { DIFFICULTIES } from "../lib/types";
import type {
  Category,
  CategoryId,
  Difficulty,
  Grade,
  ProblemId,
  ProblemWithCategories,
} from "../lib/types";
import { dateInputValue, getErrorMessage, inputDateTimestamp } from "../lib/utils";
import { Modal, Toggle } from "./Primitives";

export function ProblemForm({
  open,
  onClose,
  onCreated,
  problem,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (problemId: ProblemId) => void;
  problem?: ProblemWithCategories;
  categories: Category[];
}) {
  const createProblem = useMutation(api.problems.create);
  const updateProblem = useMutation(api.problems.update);
  const createCategory = useMutation(api.categories.create);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [selected, setSelected] = useState<Set<CategoryId>>(new Set());
  const [includeAttempt, setIncludeAttempt] = useState(true);
  const [attemptedAt, setAttemptedAt] = useState(dateInputValue());
  const [grade, setGrade] = useState<Grade>("B");
  const [shouldReviewAgain, setShouldReviewAgain] = useState(false);
  const [reviewDate, setReviewDate] = useState<string>();
  const [notes, setNotes] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const formKey = `problem:${problem?._id ?? "new"}`;
  const request = useFormRequest<{
    kind: "save" | "category";
    name: string;
    url: string;
    difficulty: Difficulty;
    categoryIds: CategoryId[];
    includeAttempt: boolean;
    attemptedAt: string;
    grade: Grade;
    shouldReviewAgain: boolean;
    notes: string;
    reviewDate?: string;
    categorySearch: string;
  }>(formKey);
  const busy = request.pending;
  const saving = busy && request.state?.draft.kind === "save";
  const session = useRef(0);
  const dismiss = () => {
    session.current++;
    onClose();
  };
  useEffect(
    () => () => {
      session.current++;
    },
    [],
  );
  const draft = (kind: "save" | "category") => ({
    kind,
    name,
    url,
    difficulty,
    categoryIds: [...selected],
    includeAttempt,
    attemptedAt,
    grade,
    shouldReviewAgain,
    reviewDate,
    notes,
    categorySearch,
  });
  const [error, setError] = useState("");

  const initializedFor = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!open) {
      initializedFor.current = undefined;
      session.current++;
      return;
    }
    if (initializedFor.current === formKey) return;
    initializedFor.current = formKey;
    session.current++;
    const savedDraft =
      request.state?.status !== "success" || request.state.draft.kind === "category"
        ? request.state?.draft
        : undefined;
    setName(savedDraft?.name ?? problem?.name ?? "");
    setUrl(savedDraft?.url ?? problem?.url ?? "");
    setDifficulty(savedDraft?.difficulty ?? problem?.difficulty ?? "medium");
    setSelected(new Set(savedDraft?.categoryIds ?? problem?.categoryIds ?? []));
    setIncludeAttempt(savedDraft?.includeAttempt ?? true);
    setAttemptedAt(savedDraft?.attemptedAt ?? dateInputValue());
    setGrade(savedDraft?.grade ?? "B");
    setShouldReviewAgain(savedDraft?.shouldReviewAgain ?? false);
    setReviewDate(savedDraft?.reviewDate);
    setNotes(savedDraft?.notes ?? "");
    setCategorySearch(savedDraft?.categorySearch ?? "");
    setError("");
    if (request.state?.status === "success" && request.state.draft.kind === "save") request.clear();
  }, [open, problem, formKey, request]);

  useEffect(() => {
    if (open && request.state?.status === "success" && request.state.draft.kind === "category") {
      const categoryId = request.state.result as CategoryId;
      setSelected((current) => new Set([...current, categoryId]));
      setCategorySearch("");
      request.clear();
    }
  }, [open, request]);
  const unavailableCategories = [...selected].filter(
    (id) => !categories.some((category) => category._id === id),
  );

  const visibleCategories = useMemo(() => {
    const needle = categorySearch.trim().toLocaleLowerCase();
    if (!needle) return categories;
    return categories.filter((category) => category.name.toLocaleLowerCase().includes(needle));
  }, [categories, categorySearch]);

  const exactMatch = categories.some(
    (category) => category.name.toLocaleLowerCase() === categorySearch.trim().toLocaleLowerCase(),
  );

  const toggleCategory = (categoryId: CategoryId) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(categoryId)) next.delete(categoryId);
      else if (next.size < 12) next.add(categoryId);
      return next;
    });
  };

  const handleCreateCategory = async () => {
    if (busy || !categorySearch.trim()) return;
    if (selected.size >= 12) {
      setError("Remove a category before adding another one to this problem.");
      return;
    }
    setError("");
    await request.run(draft("category"), () => createCategory({ name: categorySearch }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (unavailableCategories.length) {
      setError("Remove unavailable categories before saving.");
      return;
    }
    setError("");
    const currentSession = session.current;
    const values = {
      name,
      url,
      difficulty,
      categoryIds: [...selected],
      reviewDate: reviewDate === undefined ? undefined : reviewDate || null,
    };
    const completed = await request.run(draft("save"), async () => {
      if (problem) {
        await updateProblem({ problemId: problem._id, ...values });
        return undefined;
      }
      return await createProblem({
        ...values,
        ...(includeAttempt
          ? {
              firstAttempt: {
                attemptedAt: inputDateTimestamp(attemptedAt),
                grade,
                shouldReviewAgain,
                notes,
              },
            }
          : {}),
      });
    });
    if (completed && currentSession === session.current) {
      if (completed.result) onCreated?.(completed.result);
      dismiss();
    }
  };

  return (
    <Modal
      open={open}
      onClose={dismiss}
      eyebrow={problem ? "Edit entry" : "New entry"}
      title={problem ? "Update problem" : "Add a problem"}
      width="max-w-3xl"
    >
      {request.state?.status === "success" && request.state.draft.kind === "save" ? (
        <div className="space-y-4 p-6">
          <p role="status">Problem saved.</p>
          <button className="button-primary" onClick={dismiss}>
            Done
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="px-5 py-5 sm:px-6">
          <fieldset disabled={busy} className="min-w-0 space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="field sm:col-span-2">
                <span>Problem name</span>
                <input
                  required
                  maxLength={120}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Longest Substring Without Repeating Characters"
                />
              </label>
              <label className="field sm:col-span-2">
                <span>Problem link</span>
                <input
                  required
                  type="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://leetcode.com/problems/..."
                />
              </label>
            </div>

            <fieldset>
              <legend className="field-label">Difficulty</legend>
              <div className="mt-2 grid grid-cols-3 gap-2 rounded-md bg-mist p-1.5">
                {DIFFICULTIES.map((value) => (
                  <button
                    type="button"
                    key={value}
                    onClick={() => setDifficulty(value)}
                    aria-pressed={difficulty === value}
                    className={`rounded-md px-3 py-2.5 text-sm font-semibold capitalize transition ${
                      difficulty === value
                        ? "bg-surface text-ink shadow-sm"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </fieldset>

            <div>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="field-label">Categories</p>
                  <p className="mt-1 text-xs text-muted">Choose up to 12.</p>
                </div>
                <span className="text-xs font-medium text-muted">{selected.size}/12 selected</span>
              </div>
              <div className="relative mt-3">
                <Search
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
                  size={16}
                />
                <input
                  className="input pl-10"
                  value={categorySearch}
                  onChange={(event) => setCategorySearch(event.target.value)}
                  placeholder="Search or create a category"
                  aria-label="Search or create a category"
                  maxLength={48}
                />
              </div>
              {unavailableCategories.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-sm text-muted">
                    A selected category is unavailable. Remove it to continue.
                  </p>
                  {unavailableCategories.map((id) => (
                    <button
                      key={id}
                      type="button"
                      className="button-secondary"
                      onClick={() => toggleCategory(id)}
                    >
                      <X size={14} />
                      Remove unavailable category
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-3 max-h-32 overflow-y-auto rounded-md border border-line p-2">
                {categorySearch.trim() && !exactMatch && (
                  <button
                    type="button"
                    onClick={() => void handleCreateCategory()}
                    className="mb-1 flex w-full items-center gap-2 rounded-md bg-accent-soft px-3 py-2.5 text-left text-sm font-semibold text-accent-ink"
                  >
                    <Plus size={15} /> Create “{categorySearch.trim()}”
                  </button>
                )}
                <div className="flex flex-wrap gap-2">
                  {visibleCategories.map((category) => {
                    const active = selected.has(category._id);
                    return (
                      <button
                        type="button"
                        key={category._id}
                        onClick={() => toggleCategory(category._id)}
                        aria-pressed={active}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                          active
                            ? "border-accent bg-accent text-on-accent"
                            : "border-line bg-surface text-muted hover:border-stone hover:text-ink"
                        }`}
                      >
                        {active ? <Check size={13} /> : <Tag size={13} />}
                        {category.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <label className="field">
              <span>Review date</span>
              <input
                type="date"
                max="9999-12-31"
                value={reviewDate ?? problem?.reviewDate ?? ""}
                onChange={(event) => setReviewDate(event.target.value)}
              />
              <small>Optional. Saved to your calendar with this problem.</small>
            </label>

            {!problem && (
              <section className="border-t border-line pt-4">
                <Toggle
                  checked={includeAttempt}
                  onChange={setIncludeAttempt}
                  label="I attempted this problem"
                  description="Turn this off if you’re only adding it to your library."
                />

                {includeAttempt && (
                  <div className="mt-4 space-y-5">
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
                              aria-pressed={grade === value}
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
                      description="Add this problem to your review queue."
                    />

                    <label className="field">
                      <span>Attempt notes</span>
                      <textarea
                        rows={5}
                        maxLength={4000}
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        placeholder="What clicked? What tripped you up? Leave context for your future self."
                      />
                      <small>{notes.length}/4,000</small>
                    </label>
                  </div>
                )}
              </section>
            )}

            {(error || request.state?.status === "error") && (
              <p className="form-error" role="alert">
                {error || getErrorMessage(request.state?.error)}
              </p>
            )}
          </fieldset>
          {busy && (
            <p role="status" className="py-3 text-sm text-muted">
              Save pending. Closing won’t cancel it.
            </p>
          )}
          <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-col-reverse gap-3 border-t border-line bg-surface px-5 py-4 sm:-mx-6 sm:flex-row sm:justify-end sm:px-6">
            <button type="button" className="button-secondary" onClick={dismiss}>
              {busy ? "Close" : "Cancel"}
            </button>
            <button type="submit" className="button-primary" disabled={busy}>
              {saving ? "Saving…" : problem ? "Save changes" : "Add problem"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
