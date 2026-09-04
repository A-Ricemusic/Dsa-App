import { useEffect, type ReactNode } from "react";
import { AlertTriangle, Check, X } from "lucide-react";
import type { Difficulty, Grade } from "../lib/types";

export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  children,
  width = "max-w-2xl",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  children: ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-5">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-deep/55 backdrop-blur-[3px]"
        onClick={onClose}
        aria-label="Close dialog"
      />
      <section
        aria-modal="true"
        role="dialog"
        aria-labelledby="dialog-title"
        className={`relative max-h-[94vh] w-full ${width} overflow-y-auto rounded-t-[2rem] bg-surface shadow-modal sm:rounded-[2rem]`}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-line bg-surface/95 px-6 py-5 backdrop-blur sm:px-8">
          <div>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h2 id="dialog-title" className="mt-1 font-display text-2xl text-ink">
              {title}
            </h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return <span className={`difficulty difficulty-${difficulty}`}>{difficulty}</span>;
}

export function GradeBadge({ grade, large = false }: { grade?: Grade; large?: boolean }) {
  if (!grade) return <span className="text-sm text-muted">—</span>;
  return (
    <span className={`grade grade-${grade.toLowerCase()} ${large ? "size-12 text-lg" : ""}`}>
      {grade}
    </span>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-5 rounded-2xl border border-line bg-canvas/60 p-4">
      <span>
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {description && (
          <span className="mt-1 block text-xs leading-5 text-muted">{description}</span>
        )}
      </span>
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="toggle-track">
        <span className="toggle-knob">
          {checked && <Check size={12} className="text-accent" strokeWidth={3} />}
        </span>
      </span>
    </label>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid min-h-72 place-items-center rounded-[1.75rem] border border-dashed border-stone bg-surface/50 px-6 text-center">
      <div className="max-w-sm py-10">
        <div className="mx-auto mb-5 grid size-12 place-items-center rounded-2xl bg-mist text-muted">
          <AlertTriangle size={20} />
        </div>
        <h3 className="font-display text-2xl text-ink">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
        {action && <div className="mt-6">{action}</div>}
      </div>
    </div>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-muted">
      <span className="size-4 animate-spin rounded-full border-2 border-stone border-t-accent" />
      {label}
    </div>
  );
}
