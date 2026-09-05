import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "./auth/AuthProvider";
import { useMutation, useConvexAuth, useQuery } from "convex/react";
import { routeFromPath } from "./lib/routes";
import {
  ArrowRight,
  BrainCircuit,
  Check,
  Layers3,
  LockKeyhole,
  RefreshCcw,
  Sparkles,
} from "lucide-react";
import { api } from "../convex/_generated/api";
import type { AttemptId, ProblemId, ProblemWithCategories, View } from "./lib/types";
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
  const ensureDefaults = useMutation(api.categories.ensureDefaults);
  const ensureStatsBackfill = useMutation(api.stats.ensureBackfill);
  const { route, navigate } = routing;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingProblem, setEditingProblem] = useState<ProblemWithCategories>();

  useEffect(() => {
    void ensureDefaults();
    void ensureStatsBackfill();
  }, [ensureDefaults, ensureStatsBackfill]);

  const openCreate = () => {
    setEditingProblem(undefined);
    setFormOpen(true);
    setMobileOpen(false);
  };

  const openEdit = (problem: ProblemWithCategories) => {
    setEditingProblem(problem);
    setFormOpen(true);
  };

  const activeView: View =
    route.kind === "dashboard"
      ? "dashboard"
      : route.kind === "categories"
        ? "categories"
        : "problems";

  const changeView = (view: View) => {
    navigate(view === "dashboard" ? "/" : `/${view}`);
  };

  const renderRoute = () => {
    if (route.kind === "not-found") return null;
    if (route.kind === "dashboard") {
      return (
        <Dashboard
          firstName={firstName}
          onAddProblem={openCreate}
          onOpenProblem={(problem) => navigate(`/problems/${problem._id}`)}
          onSeeAll={() => navigate("/problems")}
        />
      );
    }

    if (route.kind === "problems") {
      return (
        <ProblemsView
          onAddProblem={openCreate}
          onOpenProblem={(problem) => navigate(`/problems/${problem._id}`)}
        />
      );
    }

    if (route.kind === "categories") {
      return <CategoriesView />;
    }
    return (
      <ProblemRoute
        problemId={route.problemId}
        attemptId={route.kind === "attempt" ? route.attemptId : undefined}
        onBack={() => navigate("/problems")}
        onNavigate={navigate}
        onEdit={openEdit}
      />
    );
  };

  return (
    <Shell
      view={activeView}
      onViewChange={changeView}
      onAddProblem={openCreate}
      onSignOut={onSignOut}
      userName={firstName}
      userEmail={email}
      mobileOpen={mobileOpen}
      setMobileOpen={setMobileOpen}
    >
      {renderRoute()}

      <ProblemForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingProblem(undefined);
        }}
        problem={editingProblem}
        onCreated={(problemId) => navigate(`/problems/${problemId}`)}
      />
    </Shell>
  );
}

function ProblemRoute({
  problemId,
  attemptId,
  onBack,
  onNavigate,
  onEdit,
}: {
  problemId: ProblemId;
  attemptId?: AttemptId;
  onBack: () => void;
  onNavigate: (path: string, options?: { replace?: boolean }) => void;
  onEdit: (problem: ProblemWithCategories) => void;
}) {
  const problem = useQuery(api.problems.get, { problemId });
  const removeProblem = useMutation(api.problems.remove);

  if (problem === undefined) {
    return (
      <div className="grid min-h-[80vh] place-items-center">
        <Spinner label="Opening problem" />
      </div>
    );
  }
  if (problem === null) {
    return (
      <MissingPage
        title="Problem not found"
        description="This problem may have been deleted, or the link may no longer be valid."
        onBack={onBack}
      />
    );
  }
  if (attemptId) {
    return (
      <AttemptPage
        problem={problem}
        attemptId={attemptId}
        onBack={() => onNavigate(`/problems/${problem._id}`)}
        onDeleted={() => onNavigate(`/problems/${problem._id}`, { replace: true })}
      />
    );
  }
  return (
    <ProblemPage
      problem={problem}
      onBack={onBack}
      onOpenAttempt={(attempt) => onNavigate(`/problems/${problem._id}/attempts/${attempt._id}`)}
      onEdit={() => onEdit(problem)}
      onDelete={async () => {
        await removeProblem({ problemId: problem._id });
        onNavigate("/problems", { replace: true });
      }}
    />
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
    <main className="relative min-h-screen overflow-x-clip bg-canvas text-ink">
      <div className="hero-grid absolute inset-0 opacity-20" />
      <div className="absolute -right-48 -top-48 size-[34rem] rounded-full bg-accent/20 blur-3xl" />
      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-6 sm:px-10 lg:px-14">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-lime font-black text-deep">
              R
            </div>
            <span className="font-display text-xl">Recall</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <a className="button-secondary" href="/sign-in">
              Sign in <ArrowRight size={15} />
            </a>
          </div>
        </header>

        <div className="grid flex-1 items-center gap-16 py-16 lg:grid-cols-[1.1fr_0.9fr]">
          <section>
            <div className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/60 px-3 py-1.5 text-xs font-semibold text-muted">
              <Sparkles size={13} className="text-lime" /> Your DSA practice, remembered
            </div>
            <h1 className="mt-7 max-w-3xl font-display text-5xl leading-[0.98] sm:text-6xl lg:text-7xl">
              Solve less blindly.
              <span className="block text-lime">Remember more.</span>
            </h1>
            <p className="mt-7 max-w-xl text-base leading-8 text-muted sm:text-lg">
              A thoughtful practice journal for the problems you solve, the patterns you miss, and
              the attempts that finally make them stick.
            </p>
            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-xs text-muted">
              <span className="flex items-center gap-2">
                <Check size={14} className="text-lime" /> Private by default
              </span>
              <span className="flex items-center gap-2">
                <Check size={14} className="text-lime" /> Built around attempts
              </span>
              <span className="flex items-center gap-2">
                <Check size={14} className="text-lime" /> Your own categories
              </span>
            </div>
          </section>

          <section className="relative hidden lg:block">
            <div className="absolute inset-8 rounded-full bg-lime/10 blur-3xl" />
            <div className="relative rotate-2 rounded-[2rem] border border-line bg-surface/45 p-5 shadow-modal backdrop-blur-xl">
              <div className="rounded-[1.5rem] bg-surface p-6 text-ink">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="eyebrow">Today’s focus</p>
                    <h2 className="mt-1 font-display text-2xl">Review queue</h2>
                  </div>
                  <div className="grid size-10 place-items-center rounded-xl bg-review text-white">
                    <BrainCircuit size={19} />
                  </div>
                </div>
                <div className="mt-6 space-y-3">
                  {["Minimum Window Substring", "Course Schedule", "Coin Change"].map(
                    (name, index) => (
                      <div
                        key={name}
                        className="flex items-center gap-3 rounded-2xl bg-canvas p-4 shadow-card"
                      >
                        <span className={`grade grade-${["c", "b", "d"][index]}`}>
                          {["C", "B", "D"][index]}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold">{name}</p>
                          <p className="mt-1 text-[11px] text-muted">
                            {index + 2} attempts · Review again
                          </p>
                        </div>
                        <ArrowRight size={14} className="text-stone" />
                      </div>
                    ),
                  )}
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-deep p-4 text-white">
                    <Layers3 size={16} className="text-lime" />
                    <p className="mt-4 font-display text-2xl">70+</p>
                    <p className="text-[10px] text-white/45">topic categories</p>
                  </div>
                  <div className="rounded-2xl bg-accent-soft p-4 text-accent-ink">
                    <LockKeyhole size={16} />
                    <p className="mt-4 text-sm font-bold">Only yours</p>
                    <p className="mt-1 text-[10px] text-accent-ink/65">Account-scoped data</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
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
      <section className="w-full max-w-md rounded-[2rem] border border-line bg-surface p-8 text-center shadow-soft sm:p-10">
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
          <BrainCircuit size={20} />
        </div>
        <p className="eyebrow mt-6">Session connected</p>
        <h1 className="mt-2 font-display text-3xl text-ink">Your journal couldn’t connect.</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          WorkOS restored your session, but Convex did not accept the current access token. Reload
          once to request a fresh token.
        </p>
        <button className="button-primary mt-7" onClick={() => window.location.reload()}>
          Retry connection <RefreshCcw size={15} />
        </button>
      </section>
    </main>
  );
}
