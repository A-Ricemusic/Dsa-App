import { useEffect, useRef, useMemo, useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { Check, Plus, Search, Tag } from "lucide-react";
import { api } from "../../convex/_generated/api";
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
  const [notes, setNotes] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const busy = saving || creatingCategory;
  const [error, setError] = useState("");

  const initializedFor = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!open) {
      initializedFor.current = undefined;
      return;
    }
    const key = problem?._id ?? "new";
    if (initializedFor.current === key) return;
    initializedFor.current = key;
    setName(problem?.name ?? "");
    setUrl(problem?.url ?? "");
    setDifficulty(problem?.difficulty ?? "medium");
    setSelected(new Set(problem?.categoryIds ?? []));
    setIncludeAttempt(true);
    setAttemptedAt(dateInputValue());
    setGrade("B");
    setShouldReviewAgain(false);
    setNotes("");
    setCategorySearch("");
    setError("");
  }, [open, problem]);

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
    try {
      setError("");
      setCreatingCategory(true);
      const id = await createCategory({ name: categorySearch });
      setSelected((current) => new Set([...current, id]));
      setCategorySearch("");
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setCreatingCategory(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setSaving(true);
    setError("");
    const values = {
      name,
      url,
      difficulty,
      categoryIds: [...selected],
    };
    try {
      if (problem) {
        await updateProblem({ problemId: problem._id, ...values });
      } else {
        const problemId = await createProblem({
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
        onCreated?.(problemId);
      }
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
      busy={busy}
      onClose={onClose}
      eyebrow={problem ? "Edit entry" : "New entry"}
      title={problem ? "Update problem" : "Add a problem"}
      width="max-w-3xl"
    >
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
              {(["easy", "medium", "hard"] as const).map((value) => (
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

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-col-reverse gap-3 border-t border-line bg-surface px-5 py-4 sm:-mx-6 sm:flex-row sm:justify-end sm:px-6">
            <button type="button" className="button-secondary" disabled={busy} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="button-primary" disabled={busy}>
              {saving ? "Saving…" : problem ? "Save changes" : "Add problem"}
            </button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
