import { useMemo, useState } from "react";
import {
  ArrowUpDown,
  ExternalLink,
  Filter,
  Plus,
  RefreshCcw,
  Search,
} from "lucide-react";
import type {
  Category,
  Difficulty,
  Grade,
  ProblemWithCategories,
  SortKey,
} from "../lib/types";
import { formatShortDate, sortProblems } from "../lib/utils";
import { DifficultyBadge, EmptyState, GradeBadge } from "./Primitives";

type GradeFilter = "all" | Grade | "strong" | "unattempted";

export function ProblemsView({
  problems,
  categories,
  onAddProblem,
  onOpenProblem,
}: {
  problems: ProblemWithCategories[];
  categories: Category[];
  onAddProblem: () => void;
  onOpenProblem: (problem: ProblemWithCategories) => void;
}) {
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState<"all" | Difficulty>("all");
  const [grade, setGrade] = useState<GradeFilter>("all");
  const [categoryId, setCategoryId] = useState("all");
  const [reviewOnly, setReviewOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("recent");

  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    const matches = problems.filter((problem) => {
      const matchesSearch =
        !needle ||
        problem.name.toLocaleLowerCase().includes(needle) ||
        problem.categories.some((category) =>
          category.name.toLocaleLowerCase().includes(needle),
        );
      const matchesDifficulty =
        difficulty === "all" || problem.difficulty === difficulty;
      const matchesGrade =
        grade === "all" ||
        (grade === "strong" &&
          (problem.latestGrade === "A" || problem.latestGrade === "B")) ||
        (grade === "unattempted" && !problem.latestGrade) ||
        problem.latestGrade === grade;
      const matchesCategory =
        categoryId === "all" ||
        problem.categoryIds.some((id) => id === categoryId);
      const matchesReview = !reviewOnly || problem.latestShouldReview;
      return (
        matchesSearch &&
        matchesDifficulty &&
        matchesGrade &&
        matchesCategory &&
        matchesReview
      );
    });
    return sortProblems(matches, sort);
  }, [problems, search, difficulty, grade, categoryId, reviewOnly, sort]);

  const hasFilters =
    search ||
    difficulty !== "all" ||
    grade !== "all" ||
    categoryId !== "all" ||
    reviewOnly;

  const clearFilters = () => {
    setSearch("");
    setDifficulty("all");
    setGrade("all");
    setCategoryId("all");
    setReviewOnly(false);
  };

  return (
    <div className="page-wrap">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Practice library</p>
          <h1 className="mt-2 font-display text-4xl text-ink sm:text-5xl">Problems</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
            Search the work you’ve done, surface weak spots, and decide what deserves another pass.
          </p>
        </div>
        <button className="button-primary" onClick={onAddProblem}>
          <Plus size={17} /> Add problem
        </button>
      </div>

      <section className="mt-8 rounded-[1.75rem] border border-line bg-white p-4 shadow-card sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(15rem,1fr)_repeat(4,minmax(8rem,auto))]">
          <label className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              className="input pl-10"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search problems or categories"
            />
          </label>
          <select
            className="select"
            value={difficulty}
            onChange={(event) => setDifficulty(event.target.value as "all" | Difficulty)}
            aria-label="Filter by difficulty"
          >
            <option value="all">All difficulties</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
          <select
            className="select"
            value={grade}
            onChange={(event) => setGrade(event.target.value as GradeFilter)}
            aria-label="Filter by latest grade"
          >
            <option value="all">All grades</option>
            <option value="strong">Strong (A or B)</option>
            <option value="A">Grade A</option>
            <option value="B">Grade B</option>
            <option value="C">Grade C</option>
            <option value="D">Grade D</option>
            <option value="F">Grade F</option>
            <option value="unattempted">Not attempted</option>
          </select>
          <select
            className="select"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            aria-label="Filter by category"
          >
            <option value="all">All categories</option>
            {categories.map((category) => (
              <option value={category._id} key={category._id}>
                {category.name}
              </option>
            ))}
          </select>
          <select
            className="select"
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            aria-label="Sort problems"
          >
            <option value="recent">Most recent</option>
            <option value="attempts">Most attempted</option>
            <option value="grade">Best latest grade</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <button
            onClick={() => setReviewOnly((current) => !current)}
            className={`filter-chip ${reviewOnly ? "filter-chip-active" : ""}`}
          >
            <RefreshCcw size={13} /> Review again only
          </button>
          <div className="flex items-center gap-3 text-xs text-muted">
            <span>
              Showing <strong className="text-ink">{filtered.length}</strong> of {problems.length}
            </span>
            {hasFilters && (
              <button className="text-button" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="mt-5">
        {filtered.length === 0 ? (
          <EmptyState
            title={problems.length === 0 ? "No problems yet" : "No matches found"}
            description={
              problems.length === 0
                ? "Build your practice library one problem at a time."
                : "Try removing a filter or searching for something broader."
            }
            action={
              problems.length === 0 ? (
                <button className="button-primary" onClick={onAddProblem}>
                  <Plus size={16} /> Add a problem
                </button>
              ) : (
                <button className="button-secondary" onClick={clearFilters}>
                  <Filter size={15} /> Reset filters
                </button>
              )
            }
          />
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-[1.75rem] border border-line bg-white shadow-card md:block">
              <div className="grid grid-cols-[minmax(16rem,1.7fr)_8rem_9rem_7rem_8rem_2rem] items-center gap-4 border-b border-line bg-canvas/60 px-6 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
                <span>Problem</span>
                <span>Difficulty</span>
                <span>Latest</span>
                <span className="flex items-center gap-1">Attempts <ArrowUpDown size={11} /></span>
                <span>Practiced</span>
                <span />
              </div>
              <div className="divide-y divide-line">
                {filtered.map((problem) => (
                  <button
                    key={problem._id}
                    onClick={() => onOpenProblem(problem)}
                    className="group grid w-full grid-cols-[minmax(16rem,1.7fr)_8rem_9rem_7rem_8rem_2rem] items-center gap-4 px-6 py-4 text-left transition hover:bg-canvas/70"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-bold text-ink">{problem.name}</p>
                        {problem.latestShouldReview && (
                          <RefreshCcw size={13} className="shrink-0 text-review-light" />
                        )}
                      </div>
                      <p className="mt-1 truncate text-xs text-muted">
                        {problem.categories.map((category) => category.name).join(" · ") ||
                          "Uncategorized"}
                      </p>
                    </div>
                    <DifficultyBadge difficulty={problem.difficulty} />
                    <div className="flex items-center gap-2">
                      <GradeBadge grade={problem.latestGrade} />
                      <span className="text-xs text-muted">{problem.latestGrade ? "Latest" : "None"}</span>
                    </div>
                    <span className="text-sm font-semibold text-ink">{problem.attemptCount}</span>
                    <span className="text-xs text-muted">{formatShortDate(problem.latestAttemptAt)}</span>
                    <ExternalLink
                      size={15}
                      className="text-stone transition group-hover:text-accent"
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 md:hidden">
              {filtered.map((problem) => (
                <button
                  key={problem._id}
                  onClick={() => onOpenProblem(problem)}
                  className="rounded-3xl border border-line bg-white p-5 text-left shadow-card"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-bold text-ink">{problem.name}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <DifficultyBadge difficulty={problem.difficulty} />
                        {problem.latestShouldReview && (
                          <span className="review-pill">
                            <RefreshCcw size={11} /> Review
                          </span>
                        )}
                      </div>
                    </div>
                    <GradeBadge grade={problem.latestGrade} large />
                  </div>
                  <div className="mt-5 flex items-center justify-between border-t border-line pt-4 text-xs text-muted">
                    <span>{problem.attemptCount} attempts</span>
                    <span>{formatShortDate(problem.latestAttemptAt)}</span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
