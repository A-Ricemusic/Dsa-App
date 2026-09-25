import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import type { ProblemWithCategories } from "../lib/types";
import { calendarDate, calendarDays, parseCalendarDate, reviewDateLabel } from "../lib/calendar";
import { DifficultyBadge, GradeBadge } from "./Primitives";
import { ReviewDateForm } from "./ReviewDateForm";

export function CalendarView({
  problems,
  onOpenProblem,
}: {
  problems: ProblemWithCategories[];
  onOpenProblem: (problem: ProblemWithCategories) => void;
}) {
  const [today, setToday] = useState(() => calendarDate(new Date()));
  const [selected, setSelected] = useState(today);
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12),
  );
  const [search, setSearch] = useState("");
  const [scheduling, setScheduling] = useState("");
  const editor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scheduling) {
      editor.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
      editor.current?.focus({ preventScroll: true });
    }
  }, [scheduling]);
  useEffect(() => {
    const timer = window.setInterval(() => setToday(calendarDate(new Date())), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const byDate = useMemo(() => {
    const result = new Map<string, ProblemWithCategories[]>();
    for (const problem of problems) {
      if (problem.reviewDate) {
        const items = result.get(problem.reviewDate) ?? [];
        items.push(problem);
        result.set(problem.reviewDate, items);
      }
    }
    return result;
  }, [problems]);
  const daily = byDate.get(selected) ?? [];
  const overdue = problems
    .filter((problem) => problem.reviewDate && problem.reviewDate < today)
    .sort((a, b) => a.reviewDate!.localeCompare(b.reviewDate!));
  const unscheduled = problems.filter(
    (problem) => problem.latestShouldReview && !problem.reviewDate,
  );
  const matches = problems.filter((problem) =>
    problem.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );
  const target = problems.find((problem) => problem._id === scheduling);
  const monthLabel = month.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const rows = (items: ProblemWithCategories[]) =>
    items.map((problem) => (
      <div
        key={problem._id}
        className="flex flex-wrap items-center gap-3 border-b border-line py-4"
      >
        <GradeBadge grade={problem.latestGrade} />
        <button
          className="min-w-0 flex-1 text-left text-sm font-semibold hover:text-accent"
          onClick={() => onOpenProblem(problem)}
        >
          {problem.name}
        </button>
        <DifficultyBadge difficulty={problem.difficulty} />
        <button className="text-button text-xs" onClick={() => setScheduling(problem._id)}>
          {problem.reviewDate ? reviewDateLabel(problem.reviewDate) : "Set date"}
        </button>
      </div>
    ));
  return (
    <div className="page-wrap">
      <header className="mb-8">
        <p className="eyebrow">A little practice, every day</p>
        <h1 className="mt-3">Review calendar</h1>
        <p className="mt-3 text-sm text-muted">
          Give each problem its next review date. Select a day to plan your practice.
        </p>
      </header>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section aria-label="Monthly review calendar" className="min-w-0">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl" aria-live="polite">
              {monthLabel}
            </h2>
            <div className="flex items-center gap-2">
              <button
                className="icon-button"
                aria-label="Previous month"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1, 12))}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                className="button-secondary"
                onClick={() => {
                  setSelected(today);
                  const date = parseCalendarDate(today);
                  setMonth(new Date(date.getFullYear(), date.getMonth(), 1, 12));
                }}
              >
                Today
              </button>
              <button
                className="icon-button"
                aria-label="Next month"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1, 12))}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 text-center text-xs text-muted" aria-hidden="true">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="py-3">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 overflow-hidden rounded-lg border-l border-t border-line">
            {calendarDays(month).map((date) => {
              const key = calendarDate(date);
              const items = byDate.get(key) ?? [];
              return (
                <button
                  key={key}
                  aria-label={reviewDateLabel(key) + ", " + items.length + " reviews"}
                  aria-pressed={selected === key}
                  aria-current={key === today ? "date" : undefined}
                  onClick={() => {
                    setSelected(key);
                    setScheduling("");
                  }}
                  className={`min-h-20 min-w-0 border-b border-r border-line p-2 text-left transition sm:min-h-24 ${selected === key ? "bg-accent-soft ring-2 ring-inset ring-accent" : "bg-surface hover:bg-mist"} ${date.getMonth() !== month.getMonth() ? "text-muted" : "text-ink"}`}
                >
                  <span
                    className={`inline-grid size-7 place-items-center rounded-full text-sm ${key === today ? "bg-accent text-on-accent" : ""}`}
                  >
                    {date.getDate()}
                  </span>
                  {items.length > 0 && (
                    <span className="mt-2 block truncate text-xs font-semibold text-accent">
                      {items.length}
                      <span className="hidden sm:inline">
                        {" "}
                        {items.length === 1 ? "review" : "reviews"}
                      </span>
                      <span className="sm:hidden"> ·</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
        <section aria-label="Selected day reviews" className="min-w-0">
          <p className="eyebrow flex items-center gap-2">
            <CalendarDays size={15} /> Your practice plan
          </p>
          <h2 className="mt-3 text-xl">{reviewDateLabel(selected)}</h2>
          <p className="mt-2 text-sm text-muted">
            {daily.length} {daily.length === 1 ? "problem" : "problems"} to review
          </p>
          {daily.length ? (
            rows(daily)
          ) : (
            <p className="my-6 border-y border-line py-6 text-sm text-muted">
              No reviews scheduled. Choose a problem below to plan this day.
            </p>
          )}
          <label className="field mt-6">
            <span>Find a problem to schedule</span>
            <input
              type="search"
              placeholder="Search your problems…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          {search.trim() && (
            <div className="mt-2 max-h-56 overflow-auto">
              {matches.length === 0 ? (
                <p className="py-3 text-sm text-muted">No matching problems.</p>
              ) : (
                matches.map((problem) => (
                  <button
                    className="block w-full border-b border-line px-2 py-3 text-left text-sm hover:bg-mist"
                    key={problem._id}
                    onClick={() => {
                      setScheduling(problem._id);
                      setSearch("");
                    }}
                  >
                    {problem.name}
                  </button>
                ))
              )}
            </div>
          )}
          {target && (
            <div ref={editor} tabIndex={-1} aria-label="Schedule review" className="panel mt-5 p-4">
              <div className="mb-4 flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold">{target.name}</h3>
                <button className="text-button text-xs" onClick={() => setScheduling("")}>
                  Close
                </button>
              </div>
              <ReviewDateForm key={target._id + selected} problem={target} initialDate={selected} />
            </div>
          )}
        </section>
      </div>
      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section aria-label="Overdue reviews">
          <h2 className="text-lg">
            Overdue <span className="text-muted">({overdue.length})</span>
          </h2>
          <p className="mt-2 text-sm text-muted">
            Still on your list. Open a problem to practice, or select its date to reschedule.
          </p>
          <div className="mt-3 max-h-96 overflow-auto">
            {overdue.length ? (
              rows(overdue)
            ) : (
              <p className="py-5 text-sm text-muted">You’re all caught up.</p>
            )}
          </div>
        </section>
        <section aria-label="Unscheduled reviews">
          <h2 className="text-lg">
            Needs a date <span className="text-muted">({unscheduled.length})</span>
          </h2>
          <p className="mt-2 text-sm text-muted">
            Problems marked “review again” that you haven’t scheduled yet.
          </p>
          <div className="mt-3 max-h-96 overflow-auto">
            {unscheduled.length ? (
              rows(unscheduled)
            ) : (
              <p className="py-5 text-sm text-muted">No unscheduled reviews.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
