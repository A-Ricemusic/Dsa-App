import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { ExportPeriod } from "../lib/attemptExport";

const options = [
  { value: "all", label: "All time" },
  { value: "month", label: "Past 30 days" },
  { value: "year", label: "Past 365 days" },
  { value: "custom", label: "Custom dates" },
] as const;

export function ExportRangeSelect({
  value,
  onChange,
  disabled,
}: {
  value: ExportPeriod;
  onChange: (value: ExportPeriod) => void;
  disabled: boolean;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const selected = options.findIndex((option) => option.value === value);
  const expanded = open && !disabled;
  const choose = (index: number) => {
    onChange(options[index]!.value);
    setOpen(false);
  };
  useEffect(() => {
    if (!expanded) return;
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [expanded]);

  return (
    <div
      ref={root}
      className="relative w-52 max-w-full"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <span id={`${id}-label`} className="mb-2 block text-xs font-medium text-muted">
        CSV date range
      </span>
      <button
        type="button"
        role="combobox"
        aria-labelledby={`${id}-label`}
        aria-haspopup="listbox"
        aria-expanded={expanded}
        aria-controls={expanded ? `${id}-options` : undefined}
        aria-activedescendant={expanded ? `${id}-${active}` : undefined}
        disabled={disabled}
        className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-md border bg-surface px-3 text-left text-sm font-medium text-ink transition disabled:cursor-not-allowed disabled:opacity-50 ${expanded ? "border-accent ring-2 ring-accent/20" : "border-line hover:border-stone hover:bg-mist"}`}
        onClick={() => {
          setActive(selected);
          setOpen(!open);
        }}
        onKeyDown={(event) => {
          if (["ArrowDown", "ArrowUp", "Home", "End", "Enter", " ", "Escape"].includes(event.key))
            event.preventDefault();
          if (event.key === "Escape" || event.key === "Tab") {
            setOpen(false);
            return;
          }
          if (event.key === "Enter" || event.key === " ") {
            if (expanded) choose(active);
            else {
              setActive(selected);
              setOpen(true);
            }
          } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            setActive(
              expanded
                ? (active + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length
                : selected,
            );
            setOpen(true);
          } else if (event.key === "Home" || event.key === "End") {
            setActive(event.key === "Home" ? 0 : options.length - 1);
            setOpen(true);
          }
        }}
      >
        {options[selected]!.label}
        <ChevronDown
          size={15}
          aria-hidden="true"
          className={`text-muted transition ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      {expanded && (
        <div
          id={`${id}-options`}
          role="listbox"
          aria-labelledby={`${id}-label`}
          className="absolute left-0 top-full z-30 mt-2 w-full rounded-lg border border-line bg-surface p-1.5 shadow-modal"
        >
          {options.map((option, index) => (
            <button
              type="button"
              tabIndex={-1}
              key={option.value}
              id={`${id}-${index}`}
              role="option"
              aria-selected={option.value === value}
              className={`flex w-full min-h-11 cursor-pointer items-center justify-between gap-3 rounded-md px-3 text-sm ${index === active ? "bg-mist text-ink" : "text-muted"}`}
              onMouseEnter={() => setActive(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(index)}
            >
              {option.label}
              {option.value === value && (
                <Check size={16} className="text-accent" aria-hidden="true" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
