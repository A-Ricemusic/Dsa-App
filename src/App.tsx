import { useCompleteQuery } from "./lib/useCompleteQuery";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "./auth/AuthProvider";
import { useMutation, useConvexAuth } from "convex/react";
import { routeFromPath } from "./lib/routes";
import { ArrowRight, BrainCircuit, RefreshCcw } from "lucide-react";
import { api } from "../convex/_generated/api";
import type { ProblemId, ProblemWithCategories, View } from "./lib/types";
import { AttemptPage } from "./components/AttemptPage";
import { CategoriesView } from "./components/CategoriesView";
import { Dashboard } from "./components/Dashboard";
import { ProblemForm } from "./components/ProblemForm";
import { ProblemPage } from "./components/ProblemPage";
import { ProblemsView } from "./components/ProblemsView";
import { Shell } from "./components/Shell";
import { Spinner } from "./components/Primitives";
import { ThemeToggle } from "./components/Theme";

export default function App() {
  const { loading: isLoading, user, signOut, error, retry } = useAuth();
  const routing = useAppRoute();
  const { isLoading: isConvexLoading, isAuthenticated: isConvexAuthenticated } = useConvexAuth();

  if (routing.route.kind === "not-found")
    return (
      <MissingPage
        title="Page not found"
        description="This address doesn't match a page in Recall."
        onBack={() => routing.navigate("/problems")}
      />
    );

  if (error && !user)
    return (
      <MissingPage
        title="Unable to check your session"
        description="Your session has not been cleared. Check your connection and retry."
        onBack={retry}
        backLabel="Retry"
      />
    );

  if (isLoading || (user && isConvexLoading)) return <FullPageLoading />;

  if (!user) return <Landing />;

  if (!isConvexAuthenticated) return <AuthConnectionError />;

  return (
    <>
      {error && (
        <div role="alert" className="bg-surface p-3 text-center text-sm text-ink">
          Authentication could not be updated.{" "}
          <button onClick={retry} className="underline">
            Retry
          </button>
        </div>
      )}
      <Tracker
        key={user.id}
        firstName={user.firstName ?? user.email.split("@")[0] ?? "there"}
        email={user.email}
        onSignOut={() => void signOut()}
        routing={routing}
      />
    </>
  );
}

function Tracker({
  firstName,
  email,
  onSignOut,
  routing,
}: {
  firstName: string;
  email: string;
  onSignOut: () => void;
  routing: ReturnType<typeof useAppRoute>;
}) {
  const rawProblems = useCompleteQuery(api.problems.listPage, {});
  const attemptGrades = useCompleteQuery(api.attempts.listGradesPage, {});
  const rawCategories = useCompleteQuery(api.categories.listPage, {});
  const categories = useMemo(
    () =>
      rawCategories ? [...rawCategories].sort((a, b) => a.name.localeCompare(b.name)) : undefined,
    [rawCategories],
  );
  const assignments = useCompleteQuery(api.problems.listCategoryAssignmentsPage, {});
  const ensureDefaults = useMutation(api.categories.ensureDefaults);
  const removeProblem = useMutation(api.problems.remove);
  const { route, navigate } = routing;
  const [reviewOnly, setReviewOnly] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<ProblemId>();

  const [defaultsError, setDefaultsError] = useState(false);
  const seedDefaults = useCallback(async () => {
    setDefaultsError(false);
    try {
      await ensureDefaults();
    } catch {
      setDefaultsError(true);
    }
  }, [ensureDefaults]);
  useEffect(() => {
    void seedDefaults();
  }, [seedDefaults]);

  const problems = useMemo<ProblemWithCategories[]>(() => {
    if (!rawProblems || !categories || !assignments) return [];
    const categoryById = new Map(categories.map((category) => [category._id, category]));
    const idsByProblem = new Map<ProblemId, ProblemWithCategories["categoryIds"]>();
    for (const assignment of assignments) {
      const ids = idsByProblem.get(assignment.problemId) ?? [];
      ids.push(assignment.categoryId);
      idsByProblem.set(assignment.problemId, ids);
    }
    return rawProblems.map((problem) => {
      const categoryIds = idsByProblem.get(problem._id) ?? [];
      return {
        ...problem,
        categoryIds,
        categories: categoryIds
          .map((categoryId) => categoryById.get(categoryId))
          .filter((category) => category !== undefined),
      };
    });
  }, [rawProblems, categories, assignments]);

  const editingProblem = problems.find((problem) => problem._id === editingId);
  const loading =
    rawProblems === undefined ||
    attemptGrades === undefined ||
    categories === undefined ||
    assignments === undefined;

  const openCreate = () => {
    setEditingId(undefined);
    setFormOpen(true);
  };

  const openEdit = (problem: ProblemWithCategories) => {
    setEditingId(problem._id);
    setFormOpen(true);
  };

  const activeView: View =
    route.kind === "dashboard"
      ? "dashboard"
      : route.kind === "categories"
        ? "categories"
        : "problems";

  const changeView = (view: View) => {
    setReviewOnly(false);
    navigate(view === "dashboard" ? "/" : `/${view}`);
  };

  const renderRoute = () => {
    if (route.kind === "not-found") return null;
    if (loading) {
      return (
        <div className="grid min-h-[80vh] place-items-center">
          <Spinner label="Opening your journal" />
        </div>
      );
    }

    if (route.kind === "dashboard") {
      return (
        <Dashboard
          problems={problems}
          attemptGrades={attemptGrades ?? []}
          firstName={firstName}
          onAddProblem={openCreate}
          onOpenProblem={(problem) => navigate(`/problems/${problem._id}`)}
          onSeeAll={(onlyReview = false) => {
            setReviewOnly(onlyReview);
            navigate("/problems");
          }}
        />
      );
    }

    if (route.kind === "problems") {
      return (
        <ProblemsView
          key={reviewOnly ? "review" : "all"}
          initialReviewOnly={reviewOnly}
          problems={problems}
          categories={categories ?? []}
          onAddProblem={openCreate}
          onOpenProblem={(problem) => navigate(`/problems/${problem._id}`)}
        />
      );
    }

    if (route.kind === "categories") {
      return <CategoriesView categories={categories ?? []} problems={problems} />;
    }

    const problem = problems.find((item) => item._id === route.problemId);
    if (!problem) {
      return (
        <MissingPage
          title="Problem not found"
          description="This problem may have been deleted, or the link may no longer be valid."
          onBack={() => navigate("/problems")}
        />
      );
    }

    if (route.kind === "attempt") {
      return (
        <AttemptPage
          problem={problem}
          attemptId={route.attemptId}
          onBack={() => navigate(`/problems/${problem._id}`)}
          onDeleted={() => navigate(`/problems/${problem._id}`, { replace: true })}
        />
      );
    }

    return (
      <ProblemPage
        problem={problem}
        onBack={() => navigate("/problems")}
        onOpenAttempt={(attempt) => navigate(`/problems/${problem._id}/attempts/${attempt._id}`)}
        onEdit={() => openEdit(problem)}
        onDelete={async () => {
          await removeProblem({ problemId: problem._id });
          navigate("/problems", { replace: true });
        }}
      />
    );
  };

  return (
    <Shell
      view={activeView}
      onViewChange={changeView}
      onSignOut={onSignOut}
      userName={firstName}
      userEmail={email}
    >
      {defaultsError && (
        <p role="alert" className="border-b border-line py-3 text-sm text-muted">
          Default categories couldn’t be loaded.{" "}
          <button className="underline" onClick={() => void seedDefaults()}>
            Retry
          </button>
        </p>
      )}
      {renderRoute()}

      <ProblemForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingId(undefined);
        }}
        problem={editingProblem}
        categories={categories ?? []}
        onCreated={(problemId) => navigate(`/problems/${problemId}`)}
      />
    </Shell>
  );
}

function useAppRoute() {
  const [pathname, setPathname] = useState(window.location.pathname);
  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  const route = useMemo(() => routeFromPath(pathname), [pathname]);

  const navigate = useCallback((path: string, options?: { replace?: boolean }) => {
    if (options?.replace) window.history.replaceState(null, "", path);
    else window.history.pushState(null, "", path);
    setPathname(window.location.pathname);
    window.scrollTo({ top: 0 });
  }, []);

  return { route, navigate };
}

function MissingPage({
  title,
  description,
  onBack,
  backLabel = "Back to problems",
}: {
  title: string;
  description: string;
  onBack: () => void;
  backLabel?: string;
}) {
  return (
    <div className="page-wrap">
      <section className="panel mx-auto max-w-xl p-8 text-center sm:p-10">
        <p className="eyebrow">Nothing here</p>
        <h1 className="mt-2 font-display text-3xl text-ink">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-muted">{description}</p>
        <button className="button-primary mt-7" onClick={onBack}>
          {backLabel}
        </button>
      </section>
    </div>
  );
}

function Landing() {
  return (
    <main className="min-h-screen bg-canvas text-ink">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 sm:px-10">
        <header className="flex items-center justify-between border-b border-line py-5">
          <span className="brand">
            <span className="brand-mark">r.</span>recall.
          </span>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <a className="text-button" href="/sign-in">
              Sign in <ArrowRight size={15} />
            </a>
          </div>
        </header>
        <div className="grid flex-1 content-center items-center gap-12 py-16 lg:grid-cols-2 lg:gap-20">
          <section>
            <p className="eyebrow">A journal for your DSA practice</p>
            <h1 className="mt-5 text-4xl leading-tight sm:text-5xl">
              Less tracking.
              <br />
              <span className="text-accent-ink">More understanding.</span>
            </h1>
            <p className="mt-5 max-w-md text-base leading-7 text-muted">
              Keep your problems, attempts, and insights together. Know what you’ve learned and what
              to practice next.
            </p>
            <a className="button-primary mt-7" href="/sign-in">
              Start your journal <ArrowRight size={16} />
            </a>
            <p className="mt-4 text-xs text-muted">
              Your notes. Your pace. A little better each time.
            </p>
          </section>
          <section aria-label="Example practice journal" className="border-y border-line py-5">
            <div className="section-heading">
              <h2>Your next review</h2>
              <span className="text-xs text-muted">Example journal</span>
            </div>
            <div className="divide-y divide-line">
              {[
                { name: "Minimum Window Substring", topic: "Sliding window", grade: "C" },
                { name: "Course Schedule", topic: "Graphs", grade: "B" },
                { name: "Coin Change", topic: "Dynamic programming", grade: "D" },
              ].map((item) => (
                <div key={item.name} className="flex items-center gap-4 py-4">
                  <span className={`grade grade-${item.grade.toLowerCase()}`}>{item.grade}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="mt-1 text-xs text-muted">{item.topic}</p>
                  </div>
                  <RefreshCcw size={14} className="text-muted" />
                </div>
              ))}
            </div>
            <p className="mt-5 border-t border-line pt-4 text-xs leading-5 text-muted">
              A clear view of what needs another pass, with your notes one click away.
            </p>
          </section>
        </div>
        <footer className="border-t border-line py-5 text-xs text-muted">
          Recall · A little practice, remembered.
        </footer>
      </div>
    </main>
  );
}

function FullPageLoading() {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas">
      <Spinner label="Checking your session" />
    </main>
  );
}

function AuthConnectionError() {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-6">
      <section className="w-full max-w-md py-8 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
          <BrainCircuit size={20} />
        </div>
        <p className="eyebrow mt-6">Session connected</p>
        <h1 className="mt-2 font-display text-3xl text-ink">Your journal couldn’t connect.</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          We couldn’t load your journal. Try reconnecting to continue.
        </p>
        <button className="button-primary mt-7" onClick={() => window.location.reload()}>
          Retry connection <RefreshCcw size={15} />
        </button>
      </section>
    </main>
  );
}
