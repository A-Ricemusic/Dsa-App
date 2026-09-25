import { useMemo, useRef, useState } from "react";
import { useConvex } from "convex/react";
import { api } from "../../convex/_generated/api";
import { exportRange, loadExportAttempts, type ExportPeriod } from "../lib/attemptExport";
import { Download } from "lucide-react";
import type { Category, ProblemWithCategories } from "../lib/types";
import { buildTopicStats, downloadTopicsCsv, topicFocus } from "../lib/topicStats";
import { EmptyState } from "./Primitives";

export function TopicsView({
  categories,
  problems,
}: {
  categories: Category[];
  problems: ProblemWithCategories[];
}) {
  const topics = useMemo(() => buildTopicStats(categories, problems), [categories, problems]);
  const convex = useConvex();
  const exportingRef = useRef(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [period, setPeriod] = useState<ExportPeriod>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const exportCsv = async () => {
    if (exportingRef.current) return;
    let range;
    try {
      range = exportRange(period, from, to);
    } catch {
      setExportError("Choose a valid start and end date.");
      return;
    }
    exportingRef.current = true;
    setExporting(true);
    setExportError("");
    try {
      const histories = await loadExportAttempts(
        problems,
        (problemId, cursor, numItems) =>
          convex.query(api.attempts.listForProblemPage, {
            problemId,
            paginationOpts: { cursor, numItems },
          }),
        range,
      );
      if (!histories.length) {
        setExportError("No attempts in this date range. Choose another range.");
        return;
      }
      downloadTopicsCsv(
        buildTopicStats(
          categories,
          histories.map(({ problem }) => problem),
        ),
        histories,
      );
    } catch {
      setExportError("Couldn’t load attempt history or export the CSV. Please try again.");
    } finally {
      exportingRef.current = false;
      setExporting(false);
    }
  };
  const practiced = topics.filter((topic) => topic.attempted > 0);
  const weak = topics.filter((topic) => topic.average !== null && topic.average < 2.5);
  const suggestions = topics
    .filter((topic) => topic.id !== "uncategorized" && topicFocus(topic) !== "Keep practicing")
    .slice(0, 3);
  return (
    <div className="page-wrap">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Know what to practice next</p>
          <h1>Topic overview</h1>
          <p className="page-description">
            Your all-time practice by topic, using your assigned categories.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <label className="field">
          <span>CSV date range</span>
          <select
            value={period}
            disabled={exporting}
            onChange={(event) => {
              setPeriod(event.target.value as ExportPeriod);
              setExportError("");
            }}
          >
            <option value="all">All time</option>
            <option value="month">Past 30 days</option>
            <option value="year">Past 365 days</option>
            <option value="custom">Custom dates</option>
          </select>
        </label>
        {period === "custom" && (
          <>
            <label className="field">
              <span>From</span>
              <input
                type="date"
                value={from}
                disabled={exporting}
                onChange={(event) => setFrom(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Through</span>
              <input
                type="date"
                value={to}
                disabled={exporting}
                onChange={(event) => setTo(event.target.value)}
              />
            </label>
          </>
        )}
        <button
          className="button-primary"
          disabled={!topics.length || exporting}
          onClick={() => void exportCsv()}
        >
          <Download size={16} />
          {exporting ? "Preparing CSV…" : "Export CSV"}
        </button>
      </div>
      <p className="mt-3 text-xs leading-5 text-muted">
        The CSV range applies to both category summaries and problem rows. Counts include all
        attempts in the range; grades use each problem’s latest attempt in that range. Notes 1–5
        show the five newest attempts in the range, newest first. Missing notes are NA. The overview
        below remains all-time.
      </p>
      {exportError && (
        <p role="alert" className="form-error">
          {exportError}
        </p>
      )}
      {exporting && (
        <p role="status" className="text-sm text-muted">
          Loading practice history for the selected range…
        </p>
      )}
      <dl className="stats-strip">
        <div>
          <dt>Topics practiced</dt>
          <dd>{practiced.length}</dd>
        </div>
        <div>
          <dt>Questions attempted</dt>
          <dd>{problems.filter((problem) => problem.attemptCount > 0).length}</dd>
        </div>
        <div>
          <dt>Need practice</dt>
          <dd>{weak.length}</dd>
        </div>
        <div>
          <dt>Not practiced</dt>
          <dd>{topics.length - practiced.length}</dd>
        </div>
        <div>
          <dt>Total attempts</dt>
          <dd>{problems.reduce((sum, problem) => sum + problem.attemptCount, 0)}</dd>
        </div>
      </dl>
      {topics.length === 0 ? (
        <EmptyState
          title="Build your topic overview"
          description="Add categories to your problems and record attempts to see your strengths and practice gaps here."
        />
      ) : (
        <>
          <section aria-labelledby="focus-heading" className="mb-8">
            <div className="section-heading">
              <h2 id="focus-heading">Today’s focus</h2>
            </div>
            <p className="text-sm leading-6 text-muted">
              Start with averages below B (2.5), then explore unpracticed topics and flagged
              reviews. Small samples are a starting point, not a measure of mastery.
            </p>
            {suggestions.length ? (
              <ul className="mt-4 grid gap-4 sm:grid-cols-3">
                {suggestions.map((topic) => (
                  <li key={topic.id} className="border-l-2 border-accent pl-4">
                    <p className="font-medium">{topic.name}</p>
                    <p className="mt-1 text-sm text-muted">
                      {topicFocus(topic)} · {topic.attempted} questions attempted
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="quiet-message">
                Keep building coverage across your topics. Use the table to choose your next
                practice.
              </p>
            )}
          </section>
          <section aria-labelledby="topics-heading">
            <div className="section-heading">
              <h2 id="topics-heading">All topics</h2>
              <span className="text-xs text-muted">Practice priority order</span>
            </div>
            <p id="topic-methodology" className="mb-4 text-sm leading-6 text-muted">
              Average uses the latest grade for each attempted question: A = 4, B = 3, C = 2, D = 1,
              F = 0. Ungraded questions are excluded. Each question counts once per assigned topic,
              so topic totals can overlap. A dash means no graded attempts.
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-[700px]" aria-describedby="topic-methodology">
                <caption className="sr-only">Practice and average latest grades by topic</caption>
                <thead>
                  <tr>
                    <th scope="col">Topic</th>
                    <th scope="col">Attempted / library</th>
                    <th scope="col">Attempts</th>
                    <th scope="col">Average / 4</th>
                    <th scope="col">Graded</th>
                    <th scope="col">To review</th>
                    <th scope="col">Focus</th>
                  </tr>
                </thead>
                <tbody>
                  {topics.map((topic) => (
                    <tr key={topic.id}>
                      <th scope="row" className="font-medium text-ink">
                        {topic.name}
                      </th>
                      <td>
                        {topic.attempted} / {topic.questions}
                      </td>
                      <td>{topic.attempts}</td>
                      <td>{topic.average?.toFixed(2) ?? "—"}</td>
                      <td>{topic.graded}</td>
                      <td>{topic.toReview}</td>
                      <td>{topicFocus(topic)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs leading-5 text-muted">
              Export starts with category counts and average grades, followed by one row per
              practiced problem with its grade and Attempt notes 1 through Attempt notes 5. Share
              the CSV with your LLM coach to plan a practice session.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
