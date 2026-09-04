import { useMemo, useState } from "react";
import {
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
import type { Category, Difficulty, Grade, ProblemWithCategories, SortKey } from "../lib/types";
import { sortProblems } from "../lib/utils";
import { EmptyState } from "./Primitives";
import { ProblemList } from "./ProblemList";
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
  initialReviewOnly = false,
}: {
  initialReviewOnly?: boolean;
  problems: ProblemWithCategories[];
  categories: Category[];
  onAddProblem: () => void;
  onOpenProblem: (problem: ProblemWithCategories) => void;
}) {
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState<"all" | Difficulty>("all");
  const [grade, setGrade] = useState<GradeFilter>("all");
  const [categoryId, setCategoryId] = useState("all");
  const [review, setReview] = useState<ReviewFilter>(initialReviewOnly ? "review" : "all");
  const [filtersOpen, setFiltersOpen] = useState(false);
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
        problem.categories.some((category) => category.name.toLocaleLowerCase().includes(needle));
      const matchesDifficulty = difficulty === "all" || problem.difficulty === difficulty;
      const matchesGrade =
        grade === "all" ||
        (grade === "strong" && (problem.latestGrade === "A" || problem.latestGrade === "B")) ||
        (grade === "unattempted" && !problem.latestGrade) ||
        problem.latestGrade === grade;
      const matchesCategory =
        categoryId === "all" || problem.categoryIds.some((id) => id === categoryId);
      const matchesReview =
        review === "all" ||
        (review === "review" && problem.latestShouldReview) ||
        (review === "no-review" && problem.attemptCount > 0 && !problem.latestShouldReview);
      return matchesSearch && matchesDifficulty && matchesGrade && matchesCategory && matchesReview;
    });
    return sortProblems(matches, sort);
  }, [problems, search, difficulty, grade, categoryId, review, sort]);

  const hasFilters =
    search || difficulty !== "all" || grade !== "all" || categoryId !== "all" || review !== "all";

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
          <p className="eyebrow">Your practice library</p>
          <h1>Problems</h1>
          <p className="page-description">
            Find a problem, revisit your notes, or log another attempt.
          </p>
        </div>
        <button className="button-primary" onClick={onAddProblem}>
          <Plus size={17} /> Add problem
        </button>
      </div>

      <section className="filter-toolbar">
        <div className="filter-grid">
          <label className="relative filter-search">
            <Search
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              className="input pl-10"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search problems or categories"
              aria-label="Search problems or categories"
            />
          </label>
          <button
            className="filter-toggle button-secondary sm:hidden"
            aria-expanded={filtersOpen}
            aria-controls="problem-filters"
            onClick={() => setFiltersOpen(!filtersOpen)}
          >
            <Filter size={15} />
            {filtersOpen ? "Hide filters" : "Filters & sort"}
            {hasFilters && <span className="size-1.5 rounded-full bg-accent" />}
          </button>
          <div id="problem-filters" className={`filter-options ${filtersOpen ? "is-open" : ""}`}>
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
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
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
          <ProblemList problems={filtered} onOpenProblem={onOpenProblem} />
        )}
      </div>
    </div>
  );
}
