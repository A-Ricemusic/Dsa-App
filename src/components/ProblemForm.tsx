import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { Check, Plus, Search, Tag } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type {
  Category,
  CategoryId,
  Difficulty,
  ProblemWithCategories,
} from "../lib/types";
import { getErrorMessage } from "../lib/utils";
import { Modal } from "./Primitives";

export function ProblemForm({
  open,
  onClose,
  problem,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  problem?: ProblemWithCategories;
  categories: Category[];
}) {
  const createProblem = useMutation(api.problems.create);
  const updateProblem = useMutation(api.problems.update);
  const createCategory = useMutation(api.categories.create);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [thoughts, setThoughts] = useState("");
  const [selected, setSelected] = useState<Set<CategoryId>>(new Set());
  const [categorySearch, setCategorySearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(problem?.name ?? "");
    setUrl(problem?.url ?? "");
    setDifficulty(problem?.difficulty ?? "medium");
    setThoughts(problem?.thoughts ?? "");
    setSelected(new Set(problem?.categoryIds ?? []));
    setCategorySearch("");
    setError("");
  }, [open, problem]);

  const visibleCategories = useMemo(() => {
    const needle = categorySearch.trim().toLocaleLowerCase();
    if (!needle) return categories;
    return categories.filter((category) =>
      category.name.toLocaleLowerCase().includes(needle),
    );
  }, [categories, categorySearch]);

  const exactMatch = categories.some(
    (category) =>
      category.name.toLocaleLowerCase() === categorySearch.trim().toLocaleLowerCase(),
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
    if (!categorySearch.trim()) return;
    if (selected.size >= 12) {
      setError("Remove a category before adding another one to this problem.");
      return;
    }
    try {
      setError("");
      const id = await createCategory({ name: categorySearch });
      setSelected((current) => new Set([...current, id]));
      setCategorySearch("");
    } catch (caught) {
      setError(getErrorMessage(caught));
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const values = {
      name,
      url,
      difficulty,
      thoughts,
      categoryIds: [...selected],
    };
    try {
      if (problem) {
        await updateProblem({ problemId: problem._id, ...values });
      } else {
        await createProblem(values);
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
      onClose={onClose}
      eyebrow={problem ? "Edit entry" : "New entry"}
      title={problem ? "Update problem" : "Add a problem"}
    >
      <form onSubmit={handleSubmit} className="space-y-7 px-6 py-7 sm:px-8">
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="field sm:col-span-2">
            <span>Problem name</span>
            <input
              autoFocus
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
          <div className="mt-2 grid grid-cols-3 gap-2 rounded-2xl bg-mist p-1.5">
            {(["easy", "medium", "hard"] as const).map((value) => (
              <button
                type="button"
                key={value}
                onClick={() => setDifficulty(value)}
                className={`rounded-xl px-3 py-2.5 text-sm font-semibold capitalize transition ${
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
              maxLength={48}
            />
          </div>
          <div className="mt-3 max-h-48 overflow-y-auto rounded-2xl border border-line p-2">
            {categorySearch.trim() && !exactMatch && (
              <button
                type="button"
                onClick={() => void handleCreateCategory()}
                className="mb-1 flex w-full items-center gap-2 rounded-xl bg-accent-soft px-3 py-2.5 text-left text-sm font-semibold text-accent-ink"
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
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      active
                        ? "border-accent bg-accent text-white"
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
          <span>Overall thoughts</span>
          <textarea
            rows={5}
            maxLength={4000}
            value={thoughts}
            onChange={(event) => setThoughts(event.target.value)}
            placeholder="What clicked? What tripped you up? Leave a note for your future self."
          />
          <small>{thoughts.length}/4,000</small>
        </label>

        {error && <p className="form-error">{error}</p>}

        <div className="flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:justify-end">
          <button type="button" className="button-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button-primary" disabled={saving}>
            {saving ? "Saving…" : problem ? "Save changes" : "Add problem"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
