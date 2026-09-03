import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@workos-inc/authkit-react";
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useMutation,
  useQuery,
} from "convex/react";
import { ArrowRight, BrainCircuit, Check, Layers3, LockKeyhole, Sparkles } from "lucide-react";
import { api } from "../convex/_generated/api";
import type { ProblemId, ProblemWithCategories, View } from "./lib/types";
import { CategoriesView } from "./components/CategoriesView";
import { Dashboard } from "./components/Dashboard";
import { ProblemDetail } from "./components/ProblemDetail";
import { ProblemForm } from "./components/ProblemForm";
import { ProblemsView } from "./components/ProblemsView";
import { Shell } from "./components/Shell";
import { Spinner } from "./components/Primitives";
import { ThemeToggle } from "./components/Theme";

export default function App() {
  const { isLoading, user, signIn, signOut } = useAuth();
  const isCallback = window.location.pathname === "/callback";

  useEffect(() => {
    if (window.location.pathname === "/login" && !isLoading && !user) {
      void signIn();
    }
  }, [isLoading, signIn, user]);

  if (isLoading) return <FullPageLoading />;

  if (isCallback && !user) {
    return <AuthCallbackError onRetry={() => void signIn()} />;
  }

  return (
    <>
      <AuthLoading>
        <FullPageLoading />
      </AuthLoading>
      <Authenticated>
        {user && (
          <Tracker
            firstName={user.firstName ?? user.email.split("@")[0] ?? "there"}
            email={user.email}
            onSignOut={() => signOut({ returnTo: window.location.origin })}
          />
        )}
      </Authenticated>
      <Unauthenticated>
        <Landing onSignIn={() => void signIn()} />
      </Unauthenticated>
    </>
  );
}

function Tracker({
  firstName,
  email,
  onSignOut,
}: {
  firstName: string;
  email: string;
  onSignOut: () => void;
}) {
  const rawProblems = useQuery(api.problems.list);
  const categories = useQuery(api.categories.list);
  const assignments = useQuery(api.problems.listCategoryAssignments);
  const ensureDefaults = useMutation(api.categories.ensureDefaults);
  const removeProblem = useMutation(api.problems.remove);
  const [view, setView] = useState<View>("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<ProblemId>();
  const [selectedId, setSelectedId] = useState<ProblemId>();

  useEffect(() => {
    void ensureDefaults();
  }, [ensureDefaults]);

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

  const selectedProblem = problems.find((problem) => problem._id === selectedId);
  const editingProblem = problems.find((problem) => problem._id === editingId);
  const loading = rawProblems === undefined || categories === undefined || assignments === undefined;

  const openCreate = () => {
    setEditingId(undefined);
    setFormOpen(true);
    setMobileOpen(false);
  };

  const openEdit = (problem: ProblemWithCategories) => {
    setSelectedId(undefined);
    setEditingId(problem._id);
    setFormOpen(true);
  };

  return (
    <Shell
      view={view}
      onViewChange={setView}
      onAddProblem={openCreate}
      onSignOut={onSignOut}
      userName={firstName}
      userEmail={email}
      mobileOpen={mobileOpen}
      setMobileOpen={setMobileOpen}
    >
      {loading ? (
        <div className="grid min-h-[80vh] place-items-center">
          <Spinner label="Opening your journal" />
        </div>
      ) : view === "dashboard" ? (
        <Dashboard
          problems={problems}
          firstName={firstName}
          onAddProblem={openCreate}
          onOpenProblem={(problem) => setSelectedId(problem._id)}
          onSeeAll={() => setView("problems")}
        />
      ) : view === "problems" ? (
        <ProblemsView
          problems={problems}
          categories={categories}
          onAddProblem={openCreate}
          onOpenProblem={(problem) => setSelectedId(problem._id)}
        />
      ) : (
        <CategoriesView categories={categories} problems={problems} />
      )}

      <ProblemForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingId(undefined);
        }}
        problem={editingProblem}
        categories={categories ?? []}
      />
      <ProblemDetail
        problem={selectedProblem}
        onClose={() => setSelectedId(undefined)}
        onEdit={openEdit}
        onDelete={async (problem) => {
          await removeProblem({ problemId: problem._id });
        }}
      />
    </Shell>
  );
}

function Landing({ onSignIn }: { onSignIn: () => void }) {
  return (
    <main className="relative min-h-screen overflow-x-clip bg-canvas text-ink">
      <div className="hero-grid absolute inset-0 opacity-20" />
      <div className="absolute -right-48 -top-48 size-[34rem] rounded-full bg-accent/20 blur-3xl" />
      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-6 sm:px-10 lg:px-14">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-lime font-black text-deep">R</div>
            <span className="font-display text-xl">Recall</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button className="button-secondary" onClick={onSignIn}>
              Sign in <ArrowRight size={15} />
            </button>
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
              A thoughtful practice journal for the problems you solve, the patterns you miss,
              and the attempts that finally make them stick.
            </p>
            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-xs text-muted">
              <span className="flex items-center gap-2"><Check size={14} className="text-lime" /> Private by default</span>
              <span className="flex items-center gap-2"><Check size={14} className="text-lime" /> Built around attempts</span>
              <span className="flex items-center gap-2"><Check size={14} className="text-lime" /> Your own categories</span>
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
                      <div key={name} className="flex items-center gap-3 rounded-2xl bg-canvas p-4 shadow-card">
                        <span className={`grade grade-${["c", "b", "d"][index]}`}>{["C", "B", "D"][index]}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold">{name}</p>
                          <p className="mt-1 text-[11px] text-muted">{index + 2} attempts · Review again</p>
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

function AuthCallbackError({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-6">
      <section className="w-full max-w-md rounded-[2rem] border border-line bg-surface p-8 text-center shadow-soft sm:p-10">
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-danger/10 text-danger">
          <LockKeyhole size={20} />
        </div>
        <p className="eyebrow mt-6">Authentication interrupted</p>
        <h1 className="mt-2 font-display text-3xl text-ink">Sign-in couldn’t finish.</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          The authentication response could not be completed. Try again; if it repeats,
          verify the callback URL and allowed origin in WorkOS.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button className="button-primary" onClick={onRetry}>
            Try signing in again <ArrowRight size={15} />
          </button>
          <a className="button-secondary" href="/">
            Back to home
          </a>
        </div>
      </section>
    </main>
  );
}
