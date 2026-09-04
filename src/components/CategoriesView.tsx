import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
import { Layers3, Plus, Search, Sparkles, Tag, Trash2 } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Category } from "../lib/types";
import { getErrorMessage } from "../lib/utils";
import { EmptyState } from "./Primitives";

type CategoryWithCount = Category & { problemCount: number | null };

export function CategoriesView() {
  const createCategory = useMutation(api.categories.create);
  const removeCategory = useMutation(api.categories.remove);
  const {
    results: categories,
    status,
    loadMore,
  } = usePaginatedQuery(api.categories.listPaginated, {}, { initialNumItems: 100 });
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const visible = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return categories.filter(
      (category) => !needle || category.name.toLocaleLowerCase().includes(needle),
    );
  }, [categories, search]);

  useEffect(() => {
    if (search.trim() && status === "CanLoadMore") loadMore(100);
  }, [loadMore, search, status]);

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

  const handleRemove = async (category: CategoryWithCount) => {
    const count = category.problemCount;
    const message =
      count === null
        ? `Remove “${category.name}” from your library and from every assigned problem?`
        : count
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
          <p className="eyebrow">Organize your thinking</p>
          <h1 className="mt-2 font-display text-4xl text-ink sm:text-5xl">Categories</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
            Start with familiar LeetCode topics, then shape the taxonomy around how you learn.
          </p>
        </div>
        <div className="hidden size-14 place-items-center rounded-2xl bg-accent-soft text-accent sm:grid">
          <Layers3 size={23} />
        </div>
      </div>

      <section className="mt-8 grid gap-6 lg:grid-cols-[21rem_minmax(0,1fr)]">
        <div>
          <form onSubmit={handleCreate} className="panel p-6 lg:sticky lg:top-6">
            <div className="grid size-10 place-items-center rounded-xl bg-deep text-white">
              <Plus size={18} />
            </div>
            <h2 className="mt-5 font-display text-2xl text-ink">Add your own</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Use a category for a pattern, source, study plan, or anything else you want to filter
              by.
            </p>
            <label className="field mt-6">
              <span>Category name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. NeetCode 150"
                maxLength={48}
              />
            </label>
            {error && <p className="form-error mt-4">{error}</p>}
            <button
              type="submit"
              className="button-primary mt-4 w-full"
              disabled={saving || !name.trim()}
            >
              <Plus size={16} /> {saving ? "Adding…" : "Add category"}
            </button>
            <div className="mt-6 rounded-2xl bg-mist p-4">
              <p className="flex items-center gap-2 text-xs font-bold text-ink">
                <Sparkles size={14} className="text-accent" /> Built for your system
              </p>
              <p className="mt-2 text-xs leading-5 text-muted">
                Every category is private to your account and can be removed at any time.
              </p>
            </div>
          </form>
        </div>

        <div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-2xl text-ink">Your library</h2>
              <p className="mt-1 text-xs text-muted">
                {categories.length} {status === "Exhausted" ? "categories available" : "loaded"}
              </p>
            </div>
            <label className="relative w-full sm:w-64">
              <Search
                size={15}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                className="input pl-10"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Find a category"
              />
            </label>
          </div>

          {visible.length === 0 ? (
            <div className="mt-5">
              <EmptyState
                title="No categories found"
                description="Try a different search, or create a category using the form."
              />
            </div>
          ) : (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((category) => {
                const count = category.problemCount;
                return (
                  <article
                    key={category._id}
                    className="group rounded-3xl border border-line bg-surface p-5 shadow-card transition hover:-translate-y-0.5 hover:border-stone hover:shadow-soft"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="grid size-10 place-items-center rounded-xl bg-mist text-accent-ink">
                        <Tag size={17} />
                      </div>
                      <button
                        className="icon-button text-muted opacity-70 transition hover:text-danger sm:opacity-0 sm:group-hover:opacity-100"
                        onClick={() => void handleRemove(category)}
                        aria-label={`Remove ${category.name}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <h3 className="mt-5 truncate text-sm font-bold text-ink">{category.name}</h3>
                    <div className="mt-2 flex items-center justify-between text-xs text-muted">
                      <span>
                        {count === null
                          ? "Calculating usage…"
                          : `${count} ${count === 1 ? "problem" : "problems"}`}
                      </span>
                      <span>{category.isDefault ? "Starter" : "Custom"}</span>
                    </div>
                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-mist">
                      <div
                        className="h-full rounded-full bg-accent/70"
                        style={{ width: `${Math.min(100, (count ?? 0) * 18)}%` }}
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          {(status === "CanLoadMore" || status === "LoadingMore") && !search.trim() && (
            <div className="mt-5 flex justify-center">
              <button
                className="button-secondary"
                onClick={() => loadMore(100)}
                disabled={status === "LoadingMore"}
              >
                {status === "LoadingMore" ? "Loading…" : "Load more categories"}
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
