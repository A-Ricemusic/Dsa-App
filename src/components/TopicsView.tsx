import { useMemo } from "react";
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
        <button
          className="button-primary"
          disabled={!topics.length}
          onClick={() => downloadTopicsCsv(topics)}
        >
          <Download size={16} />
          Export CSV
        </button>
      </div>
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
              Export includes every topic, counts, averages, focus labels, and grading rules. Share
              the CSV with your LLM coach to plan a practice session. Add topic categories to
              uncategorized questions for a more useful breakdown.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
