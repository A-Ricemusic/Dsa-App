import { useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpDown,
  BookOpenCheck,
  ChartNoAxesColumnIncreasing,
  ChevronsUpDown,
  Filter,
  Gauge,
  Layers3,
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
import { SearchableSelect, type SearchableOption } from "./SearchableSelect";

type GradeFilter = "all" | Grade | "strong" | "unattempted";
type ReviewFilter = "all" | "review" | "no-review";

const DIFFICULTY_OPTIONS: SearchableOption<"all" | Difficulty>[] = [
  { value: "all", label: "All difficulties", keywords: ["any"] },
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

const GRADE_OPTIONS: SearchableOption<GradeFilter>[] = [
  { value: "all", label: "All grades", keywords: ["any"] },
  { value: "strong", label: "Strong (A or B)", keywords: ["a", "b", "best"] },
  { value: "A", label: "Grade A", keywords: ["a"] },
  { value: "B", label: "Grade B", keywords: ["b"] },
  { value: "C", label: "Grade C", keywords: ["c"] },
  { value: "D", label: "Grade D", keywords: ["d"] },
  { value: "F", label: "Grade F", keywords: ["f"] },
  { value: "unattempted", label: "Not attempted", keywords: ["none", "new"] },
];

const REVIEW_OPTIONS: SearchableOption<ReviewFilter>[] = [
  { value: "all", label: "All review states", keywords: ["any"] },
  {
    value: "review",
    label: "Review again",
    description: "Latest attempt says review",
    keywords: ["yes", "needed"],
  },
  {
    value: "no-review",
    label: "No review needed",
    description: "Latest attempt says no",
    keywords: ["no", "solid", "mastered"],
  },
];

const SORT_OPTIONS: SearchableOption<SortKey>[] = [
  { value: "recent", label: "Most recent", keywords: ["latest", "newest", "date"] },
  { value: "attempts", label: "Most attempted", keywords: ["count", "repetitions"] },
  { value: "grade", label: "Best latest grade", keywords: ["performance", "score"] },
  { value: "name", label: "Name A–Z", keywords: ["alphabetical", "alphabetic"] },
];

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
  const [review, setReview] = useState<ReviewFilter>("all");
  const [sort, setSort] = useState<SortKey>("recent");

  const categoryOptions = useMemo<SearchableOption<string>[]>(
    () => [
      { value: "all", label: "All categories", keywords: ["any"] },
      ...categories.map((category) => ({
        value: category._id,
        label: category.name,
      })),
    ],
    [categories],
  );

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
      const matchesReview =
        review === "all" ||
        (review === "review" && problem.latestShouldReview) ||
        (review === "no-review" &&
          problem.attemptCount > 0 &&
          !problem.latestShouldReview);
      return (
        matchesSearch &&
        matchesDifficulty &&
        matchesGrade &&
        matchesCategory &&
        matchesReview
      );
    });
    return sortProblems(matches, sort);
  }, [problems, search, difficulty, grade, categoryId, review, sort]);

  const hasFilters =
    search ||
    difficulty !== "all" ||
    grade !== "all" ||
    categoryId !== "all" ||
    review !== "all";

  const clearFilters = () => {
    setSearch("");
    setDifficulty("all");
    setGrade("all");
    setCategoryId("all");
    setReview("all");
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

      <section className="mt-8 rounded-[1.75rem] border border-line bg-surface p-4 shadow-card sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-[minmax(16rem,1.7fr)_repeat(5,minmax(9rem,1fr))]">
          <label className="relative sm:col-span-2 lg:col-span-3 2xl:col-span-1">
            <Search
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              className="input min-h-12 pl-10"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search problems or categories"
              aria-label="Search problems or categories"
            />
          </label>
          <SearchableSelect
            label="Difficulty"
            searchPlaceholder="Search easy, medium, or hard"
            value={difficulty}
            options={DIFFICULTY_OPTIONS}
            onChange={setDifficulty}
            icon={<Gauge size={15} />}
          />
          <SearchableSelect
            label="Latest grade"
            searchPlaceholder="Search A, B, C, D, or F"
            value={grade}
            options={GRADE_OPTIONS}
            onChange={setGrade}
            icon={<ChartNoAxesColumnIncreasing size={15} />}
          />
          <SearchableSelect
            label="Category"
            searchPlaceholder="Search categories"
            value={categoryId}
            options={categoryOptions}
            onChange={setCategoryId}
            icon={<Layers3 size={15} />}
          />
          <SearchableSelect
            label="Review status"
            searchPlaceholder="Search review status"
            value={review}
            options={REVIEW_OPTIONS}
            onChange={setReview}
            icon={<BookOpenCheck size={15} />}
            align="end"
          />
          <SearchableSelect
            label="Sort order"
            searchPlaceholder="Search sort options"
            value={sort}
            options={SORT_OPTIONS}
            onChange={setSort}
            icon={<ChevronsUpDown size={15} />}
            align="end"
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <div className="flex flex-wrap gap-2">
            {review === "review" && (
              <span className="filter-chip filter-chip-active">
                <RefreshCcw size={13} /> Latest attempt: review again
              </span>
            )}
            {review === "no-review" && (
              <span className="filter-chip filter-chip-active">
                <BookOpenCheck size={13} /> Latest attempt: no review
              </span>
            )}
          </div>
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
            <div className="hidden overflow-hidden rounded-[1.75rem] border border-line bg-surface shadow-card md:block">
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
                    <ArrowRight
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
                  className="rounded-3xl border border-line bg-surface p-5 text-left shadow-card"
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
