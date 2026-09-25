import { useEffect, useId, useRef, type ReactNode } from "react";
import { BookOpen, Check } from "lucide-react";
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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <dialog
      ref={dialogRef}
      closedby="none"
      onClose={(event) => {
        if (!event.currentTarget.open) onClose();
      }}
      aria-labelledby={titleId}
      className={`form-dialog ${width}`}
      onCancel={(event) => {
        event.preventDefault();
      }}
    >
      <div className="bg-surface">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line bg-surface px-5 py-4 sm:px-6">
          <div>
            {eyebrow && <p className="mb-1 text-xs text-muted">{eyebrow}</p>}
            <h2 id={titleId} className="text-xl text-ink">
              {title}
            </h2>
          </div>
        </div>
        {children}
      </div>
    </dialog>
  );
}

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  const baseDifficulty = difficulty.replace(/[+-]$/, "");
  return <span className={`difficulty difficulty-${baseDifficulty}`}>{difficulty}</span>;
}

export function GradeBadge({ grade, large = false }: { grade?: Grade; large?: boolean }) {
  if (!grade) return <span className="text-sm text-muted">—</span>;
  return (
    <span className={`grade grade-${grade.toLowerCase()} ${large ? "size-9 text-sm" : ""}`}>
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
    <label className="flex cursor-pointer items-center justify-between gap-5 py-2">
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
    <div className="grid min-h-60 place-items-center border-y border-line px-6 text-center">
      <div className="max-w-sm py-10">
        <div className="mx-auto mb-4 grid size-10 place-items-center text-muted">
          <BookOpen size={22} />
        </div>
        <h3 className="text-lg font-semibold text-ink">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
        {action && <div className="mt-6">{action}</div>}
      </div>
    </div>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-muted" role="status">
      <span className="size-4 animate-spin rounded-full border-2 border-stone border-t-accent" />
      {label}
    </div>
  );
}
