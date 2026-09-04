import {
  ArrowRight,
  BookOpenCheck,
  BrainCircuit,
  CheckCircle2,
  Flame,
  Plus,
  RefreshCcw,
  Sparkles,
  Target,
} from "lucide-react";
import { useQuery } from "convex/react";
import type { ReactNode } from "react";
import { api } from "../../convex/_generated/api";
import type { Grade, ProblemWithCategories } from "../lib/types";
import { averageGradeFromCounts, formatShortDate } from "../lib/utils";
import { DifficultyBadge, EmptyState, GradeBadge, Spinner } from "./Primitives";

export function Dashboard({
  firstName,
  onAddProblem,
  onOpenProblem,
  onSeeAll,
}: {
  firstName: string;
  onAddProblem: () => void;
  onOpenProblem: (problem: ProblemWithCategories) => void;
  onSeeAll: () => void;
}) {
  const data = useQuery(api.problems.dashboard);
  const stats = useQuery(api.stats.get);

  if (data === undefined || stats === undefined) {
    return (
      <div className="grid min-h-[80vh] place-items-center">
        <Spinner label="Opening your dashboard" />
      </div>
    );
  }

  const recent = data.recent;
  const nextReview = data.nextReview;
  const gradeCounts = stats.gradeCounts ?? { A: 0, B: 0, C: 0, D: 0, F: 0 };
  const avgGrade = stats.ready ? averageGradeFromCounts(gradeCounts) : "—";
  const strong = stats.ready ? gradeCounts.A + gradeCounts.B : null;
  const counts = (["A", "B", "C", "D", "F"] as Grade[]).map((grade) => ({
    grade,
    count: gradeCounts[grade],
  }));
  const maxCount = Math.max(1, ...counts.map((item) => item.count));

  return (
    <div className="page-wrap">
      <section className="relative overflow-hidden rounded-[2rem] bg-deep p-7 text-white shadow-soft sm:p-9 lg:p-11">
        <div className="hero-grid absolute inset-0 opacity-30" />
        <div className="relative max-w-2xl">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/75">
            <Sparkles size={13} className="text-lime" /> Practice with intention
          </div>
          <h1 className="font-display text-4xl leading-[1.05] sm:text-5xl">
            Good to see you, {firstName}.
            <span className="mt-2 block text-white/50">What are we sharpening today?</span>
          </h1>
          <div className="mt-8 flex flex-wrap gap-3">
            <button className="button-light" onClick={onAddProblem}>
              <Plus size={17} /> Add a problem
            </button>
            {nextReview && (
              <button className="button-dark-ghost" onClick={() => onOpenProblem(nextReview)}>
                Start review queue <ArrowRight size={16} />
              </button>
            )}
          </div>
        </div>
        <div className="absolute -bottom-12 -right-8 hidden size-72 rounded-full border-[42px] border-white/[0.04] lg:block" />
      </section>

      <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Problems tracked"
          value={stats.problemCount === null ? "—" : String(stats.problemCount)}
          detail="Your working library"
          icon={<BrainCircuit size={19} />}
          tone="green"
        />
        <StatCard
          label="Total attempts"
          value={stats.attemptCount === null ? "—" : String(stats.attemptCount)}
          detail="Every rep counts"
          icon={<Flame size={19} />}
          tone="orange"
        />
        <StatCard
          label="Latest average"
          value={avgGrade}
          detail="Across attempted problems"
          icon={<Target size={19} />}
          tone="blue"
        />
        <StatCard
          label="Feeling solid"
          value={strong === null ? "—" : String(strong)}
          detail={
            stats.reviewCount === null
              ? "Calculating review queue"
              : `${stats.reviewCount} still in review`
          }
          icon={<BookOpenCheck size={19} />}
          tone="purple"
        />
      </section>

      {recent.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="Your practice log starts here"
            description="Add the first problem you’re working on, then log each attempt to reveal progress over time."
            action={
              <button className="button-primary" onClick={onAddProblem}>
                <Plus size={16} /> Add your first problem
              </button>
            }
          />
        </div>
      ) : (
        <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.75fr)]">
          <div className="panel overflow-hidden">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Latest activity</p>
                <h2 className="mt-1 font-display text-2xl text-ink">Recently practiced</h2>
              </div>
              <button className="text-button" onClick={onSeeAll}>
                View all <ArrowRight size={14} />
              </button>
            </div>
            <div className="divide-y divide-line">
              {recent.map((problem) => (
                <button
                  key={problem._id}
                  onClick={() => onOpenProblem(problem)}
                  className="group flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-canvas/70 sm:px-6"
                >
                  <GradeBadge grade={problem.latestGrade} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-bold text-ink">{problem.name}</p>
                      <DifficultyBadge difficulty={problem.difficulty} />
                    </div>
                    <p className="mt-1 truncate text-xs text-muted">
                      {problem.categories.map((category) => category.name).join(" · ") ||
                        "Uncategorized"}
                    </p>
                  </div>
                  <div className="hidden text-right sm:block">
                    <p className="text-xs font-semibold text-ink">
                      {problem.attemptCount} {problem.attemptCount === 1 ? "attempt" : "attempts"}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {formatShortDate(problem.latestAttemptAt)}
                    </p>
                  </div>
                  <ArrowRight
                    size={15}
                    className="text-stone transition group-hover:translate-x-0.5 group-hover:text-accent"
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="panel p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="eyebrow">Grade pulse</p>
                  <h2 className="mt-1 font-display text-2xl text-ink">Latest attempts</h2>
                </div>
                <span className="text-xs text-muted">
                  {stats.problemCount === null ? "Calculating…" : `${stats.problemCount} problems`}
                </span>
              </div>
              <div className="mt-7 flex h-36 items-end justify-between gap-3">
                {counts.map(({ grade, count }) => (
                  <div
                    key={grade}
                    className="flex h-full flex-1 flex-col items-center justify-end gap-2"
                  >
                    <span className="text-xs font-semibold text-muted">{count}</span>
                    <div
                      className={`grade-bar grade-bar-${grade.toLowerCase()}`}
                      style={{ height: `${Math.max(count ? 18 : 4, (count / maxCount) * 100)}%` }}
                    />
                    <span className="text-xs font-bold text-ink">{grade}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.75rem] bg-review p-6 text-white shadow-soft">
              <div className="flex items-center justify-between">
                <div className="grid size-10 place-items-center rounded-xl bg-white/12">
                  {nextReview ? <RefreshCcw size={18} /> : <CheckCircle2 size={18} />}
                </div>
                <span className="text-3xl font-display">{stats.reviewCount ?? "—"}</span>
              </div>
              <h3 className="mt-5 font-display text-xl">
                {nextReview ? "Ready for another pass" : "Review queue is clear"}
              </h3>
              <p className="mt-2 text-sm leading-6 text-white/65">
                {nextReview
                  ? "Based on the review toggle from each problem’s newest attempt."
                  : "Nothing is marked for review on its latest attempt."}
              </p>
              {nextReview && (
                <button
                  className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-lime"
                  onClick={() => onOpenProblem(nextReview)}
                >
                  Open next problem <ArrowRight size={15} />
                </button>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
  icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
  tone: "green" | "orange" | "blue" | "purple";
}) {
  return (
    <article className="panel flex items-center gap-4 p-5">
      <div className={`stat-icon stat-${tone}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-muted">{label}</p>
        <div className="mt-1 flex items-baseline gap-2">
          <strong className="font-display text-3xl font-medium text-ink">{value}</strong>
          <span className="truncate text-[11px] text-muted">{detail}</span>
        </div>
      </div>
    </article>
  );
}
