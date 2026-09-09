import type { ReactNode } from "react";
import { BookOpen, LayoutDashboard, Layers3, LogOut } from "lucide-react";
import type { View } from "../lib/types";
import { ThemeToggle } from "./Theme";

const navigation = [
  { id: "dashboard" as const, label: "Overview", icon: LayoutDashboard },
  { id: "problems" as const, label: "Problems", icon: BookOpen },
  { id: "categories" as const, label: "Categories", icon: Layers3 },
];

export function Shell({
  view,
  onViewChange,
  onSignOut,
  userName,
  userEmail,
  children,
}: {
  view: View;
  onViewChange: (view: View) => void;
  onSignOut: () => void;
  userName: string;
  userEmail: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="app-header">
        <div className="header-inner">
          <button
            className="brand"
            onClick={() => onViewChange("dashboard")}
            aria-label="Recall overview"
          >
            <span className="brand-mark">r.</span>
            <span>
              recall<span className="text-accent">.</span>
            </span>
          </button>
          <nav aria-label="Main navigation" className="main-nav">
            {navigation.map((item) => (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                aria-current={view === item.id ? "page" : undefined}
              >
                <item.icon size={16} aria-hidden="true" />
                {item.label}
              </button>
            ))}
          </nav>
          <div className="header-account">
            <ThemeToggle />
            <span className="user-avatar" title={`${userName} · ${userEmail}`}>
              {userName.slice(0, 2).toUpperCase()}
            </span>
            <button
              className="icon-button"
              onClick={onSignOut}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
