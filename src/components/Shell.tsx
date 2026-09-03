import type { ReactNode } from "react";
import {
  BookOpen,
  ChevronRight,
  Command,
  LayoutDashboard,
  Layers3,
  LogOut,
  Menu,
  Plus,
  X,
} from "lucide-react";
import type { View } from "../lib/types";

const navigation = [
  { id: "dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
  { id: "problems" as const, label: "Problems", icon: BookOpen },
  { id: "categories" as const, label: "Categories", icon: Layers3 },
];

export function Shell({
  view,
  onViewChange,
  onAddProblem,
  onSignOut,
  userName,
  userEmail,
  mobileOpen,
  setMobileOpen,
  children,
}: {
  view: View;
  onViewChange: (view: View) => void;
  onAddProblem: () => void;
  onSignOut: () => void;
  userName: string;
  userEmail: string;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  children: ReactNode;
}) {
  const goTo = (next: View) => {
    onViewChange(next);
    setMobileOpen(false);
  };

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-canvas/90 px-4 backdrop-blur lg:hidden">
        <Logo compact />
        <button className="icon-button" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X size={19} /> : <Menu size={20} />}
          <span className="sr-only">Toggle navigation</span>
        </button>
      </header>

      {mobileOpen && (
        <div className="fixed inset-x-0 top-16 z-40 border-b border-line bg-white p-4 shadow-soft lg:hidden">
          <nav className="space-y-1">
            {navigation.map((item) => (
              <NavButton
                key={item.id}
                active={view === item.id}
                label={item.label}
                icon={<item.icon size={18} />}
                onClick={() => goTo(item.id)}
              />
            ))}
          </nav>
          <button className="button-primary mt-4 w-full" onClick={onAddProblem}>
            <Plus size={16} /> Add problem
          </button>
        </div>
      )}

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-68 flex-col bg-ink px-4 py-5 text-white lg:flex">
        <div className="px-2">
          <Logo />
        </div>
        <button className="sidebar-add mt-8" onClick={onAddProblem}>
          <span className="grid size-7 place-items-center rounded-lg bg-white text-ink">
            <Plus size={16} />
          </span>
          Add a problem
          <span className="ml-auto rounded-md border border-white/10 px-1.5 py-0.5 text-[10px] text-white/40">
            N
          </span>
        </button>

        <nav className="mt-8 space-y-1">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
            Workspace
          </p>
          {navigation.map((item) => (
            <NavButton
              key={item.id}
              active={view === item.id}
              label={item.label}
              icon={<item.icon size={18} />}
              dark
              onClick={() => goTo(item.id)}
            />
          ))}
        </nav>

        <div className="mt-auto">
          <div className="mb-4 rounded-2xl border border-white/[0.07] bg-white/[0.04] p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-lime">
              <Command size={14} /> Deliberate practice
            </div>
            <p className="mt-2 text-xs leading-5 text-white/45">
              Small notes compound into better pattern recognition.
            </p>
          </div>
          <div className="group flex items-center gap-3 rounded-2xl p-2 transition hover:bg-white/[0.05]">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-lime text-xs font-bold text-ink">
              {userName.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-white">{userName}</p>
              <p className="mt-0.5 truncate text-[10px] text-white/40">{userEmail}</p>
            </div>
            <button
              className="grid size-8 place-items-center rounded-lg text-white/35 transition hover:bg-white/10 hover:text-white"
              onClick={onSignOut}
              aria-label="Sign out"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      <main className="pb-20 lg:ml-68 lg:pb-0">{children}</main>

      <nav className="fixed inset-x-3 bottom-3 z-30 grid grid-cols-3 rounded-2xl border border-white/10 bg-ink/95 p-1.5 shadow-modal backdrop-blur lg:hidden">
        {navigation.map((item) => (
          <button
            key={item.id}
            onClick={() => goTo(item.id)}
            className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] font-semibold transition ${
              view === item.id ? "bg-white/10 text-lime" : "text-white/45"
            }`}
          >
            <item.icon size={17} />
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative grid size-9 place-items-center overflow-hidden rounded-xl bg-lime text-sm font-black text-ink">
        R
        <span className="absolute -bottom-1 -right-1 size-3 rounded-full bg-accent" />
      </div>
      {!compact && (
        <div>
          <p className="font-display text-lg leading-none text-white">Recall</p>
          <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/35">
            Practice journal
          </p>
        </div>
      )}
      {compact && <span className="font-display text-xl text-ink">Recall</span>}
    </div>
  );
}

function NavButton({
  active,
  label,
  icon,
  dark = false,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: ReactNode;
  dark?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
        dark
          ? active
            ? "bg-white/10 text-white"
            : "text-white/50 hover:bg-white/[0.05] hover:text-white/80"
          : active
            ? "bg-accent-soft text-accent-dark"
            : "text-muted hover:bg-canvas hover:text-ink"
      }`}
    >
      {icon}
      {label}
      {active && <ChevronRight size={14} className="ml-auto opacity-50" />}
    </button>
  );
}
