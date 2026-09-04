import { useMemo, useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { Plus, Search, Trash2 } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Category, ProblemWithCategories } from "../lib/types";
import { getErrorMessage } from "../lib/utils";
import { EmptyState } from "./Primitives";

export function CategoriesView({
  categories,
  problems,
}: {
  categories: Category[];
  problems: ProblemWithCategories[];
}) {
  const createCategory = useMutation(api.categories.create);
  const removeCategory = useMutation(api.categories.remove);
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const counts = useMemo(() => {
    const result = new Map<string, number>();
    for (const problem of problems) {
      for (const categoryId of problem.categoryIds) {
        result.set(categoryId, (result.get(categoryId) ?? 0) + 1);
      }
    }
    return result;
  }, [problems]);

  const visible = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return categories.filter(
      (category) => !needle || category.name.toLocaleLowerCase().includes(needle),
    );
  }, [categories, search]);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    try {
      await createCategory({ name });
      setName("");
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (category: Category) => {
    const count = counts.get(category._id) ?? 0;
    const message = count
      ? `Remove “${category.name}” from your library and ${count} assigned problem${count === 1 ? "" : "s"}?`
      : `Remove “${category.name}” from your library?`;
    if (!window.confirm(message)) return;
    try {
      setError("");
      await removeCategory({ categoryId: category._id });
    } catch (caught) {
      setError(getErrorMessage(caught));
    }
  };

  return (
    <div className="page-wrap">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Keep your library organized</p>
          <h1>Categories</h1>
          <p className="page-description">Group problems by topic, pattern, or study plan.</p>
        </div>
        <span className="text-sm text-muted">{categories.length} categories</span>
      </div>
      <form onSubmit={handleCreate} className="category-create">
        <label className="field flex-1">
          <span>New category</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Dynamic programming"
            maxLength={48}
          />
        </label>
        <button type="submit" className="button-primary" disabled={saving || !name.trim()}>
          <Plus size={16} />
          {saving ? "Adding…" : "Add category"}
        </button>
      </form>
      {error && (
        <p className="form-error mt-4" role="alert">
          {error}
        </p>
      )}
      <section className="mt-8" aria-label="Category library">
        <div className="section-heading">
          <h2>Your categories</h2>
          <label className="relative w-56 max-w-full">
            <Search
              size={15}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              className="input pl-10"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Find a category"
              aria-label="Find a category"
            />
          </label>
        </div>
        {visible.length === 0 ? (
          <EmptyState
            title="No categories found"
            description="Try a different search, or add a category above."
          />
        ) : (
          <div className="category-table">
            <table>
              <caption className="sr-only">Your categories</caption>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Problems</th>
                  <th scope="col">Type</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((category) => (
                  <tr key={category._id}>
                    <td className="font-medium text-ink">{category.name}</td>
                    <td className="tabular-nums">{counts.get(category._id) ?? 0}</td>
                    <td>{category.isDefault ? "Starter" : "Custom"}</td>
                    <td>
                      <button
                        className="row-open hover:text-danger"
                        onClick={() => void handleRemove(category)}
                        aria-label={`Remove ${category.name}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {search && (
          <p className="mt-4 text-xs text-muted" role="status">
            {visible.length} of {categories.length} categories
          </p>
        )}
      </section>
    </div>
  );
}
