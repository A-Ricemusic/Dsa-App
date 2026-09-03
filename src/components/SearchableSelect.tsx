import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

export type SearchableOption<Value extends string> = {
  value: Value;
  label: string;
  description?: string;
  keywords?: string[];
};

export function SearchableSelect<Value extends string>({
  label,
  searchPlaceholder,
  value,
  options,
  onChange,
  icon,
  align = "start",
}: {
  label: string;
  searchPlaceholder: string;
  value: Value;
  options: SearchableOption<Value>[];
  onChange: (value: Value) => void;
  icon?: ReactNode;
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const selected = options.find((option) => option.value === value) ?? options[0];
  const filteredOptions = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return options;

    const exactMatches = options.filter(
      (option) =>
        option.value.toLocaleLowerCase() === needle ||
        option.label.toLocaleLowerCase() === needle,
    );
    if (exactMatches.length > 0) return exactMatches;

    return options.filter((option) =>
      [option.label, option.description, option.value, ...(option.keywords ?? [])]
        .filter(Boolean)
        .some((term) => term!.toLocaleLowerCase().includes(needle)),
    );
  }, [options, query]);

  const close = (restoreFocus = false) => {
    setOpen(false);
    setQuery("");
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const openMenu = () => {
    const selectedIndex = options.findIndex((option) => option.value === value);
    setHighlightedIndex(Math.max(0, selectedIndex));
    setOpen(true);
  };

  const selectOption = (option: SearchableOption<Value>) => {
    onChange(option.value);
    close(true);
  };

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => inputRef.current?.focus());
    const lockPageScroll = window.matchMedia("(max-width: 639px)").matches;
    const previousOverflow = document.body.style.overflow;
    if (lockPageScroll) document.body.style.overflow = "hidden";

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      if (lockPageScroll) document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (highlightedIndex >= filteredOptions.length) setHighlightedIndex(0);
  }, [filteredOptions.length, highlightedIndex]);

  const handleListKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
      return;
    }
    if (filteredOptions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((current) => (current + 1) % filteredOptions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex(
        (current) => (current - 1 + filteredOptions.length) % filteredOptions.length,
      );
    } else if (event.key === "Home") {
      event.preventDefault();
      setHighlightedIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setHighlightedIndex(filteredOptions.length - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = filteredOptions[highlightedIndex];
      if (option) selectOption(option);
    }
  };

  return (
    <div className="relative min-w-0" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`flex min-h-12 w-full items-center gap-2 rounded-xl border bg-surface px-3.5 text-left text-sm font-bold text-ink shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
          open
            ? "border-accent/60 ring-3 ring-accent/10"
            : "border-line hover:border-stone hover:bg-mist"
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={(event) => {
          if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
            event.preventDefault();
            openMenu();
          }
        }}
      >
        {icon && <span className="shrink-0 text-muted">{icon}</span>}
        <span className="min-w-0 flex-1 truncate">{selected?.label ?? label}</span>
        <ChevronDown
          size={15}
          className={`shrink-0 text-muted transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label={`Close ${label} filter`}
            className="fixed inset-0 z-40 cursor-default bg-deep/50 backdrop-blur-[2px] sm:hidden"
            onClick={() => close(true)}
          />
          <section
            className={`fixed inset-x-3 bottom-3 z-50 flex max-h-[min(78vh,36rem)] flex-col overflow-hidden rounded-[1.75rem] border border-line bg-surface shadow-modal sm:absolute sm:inset-x-auto sm:bottom-auto sm:top-full sm:z-30 sm:mt-2 sm:max-h-96 sm:w-72 sm:rounded-2xl ${
              align === "end" ? "sm:right-0" : "sm:left-0"
            }`}
          >
            <div className="border-b border-line p-3 sm:p-2.5">
              <div className="mb-3 flex items-center justify-between px-1 sm:hidden">
                <div>
                  <p className="eyebrow">Filter problems</p>
                  <h2 className="mt-1 font-display text-2xl text-ink">{label}</h2>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => close(true)}
                  aria-label={`Close ${label} filter`}
                >
                  <X size={17} />
                </button>
              </div>
              <label className="relative block">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  ref={inputRef}
                  className="input min-h-11 pl-10 pr-9"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setHighlightedIndex(0);
                  }}
                  onKeyDown={handleListKeyDown}
                  placeholder={searchPlaceholder}
                  role="combobox"
                  aria-label={`Search ${label.toLocaleLowerCase()} options`}
                  aria-expanded="true"
                  aria-controls={listboxId}
                  aria-activedescendant={
                    filteredOptions[highlightedIndex]
                      ? `${listboxId}-${filteredOptions[highlightedIndex].value}`
                      : undefined
                  }
                  autoComplete="off"
                />
                {query && (
                  <button
                    type="button"
                    className="absolute right-2.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-mist hover:text-ink"
                    onClick={() => {
                      setQuery("");
                      inputRef.current?.focus();
                    }}
                    aria-label="Clear option search"
                  >
                    <X size={14} />
                  </button>
                )}
              </label>
            </div>

            <div
              id={listboxId}
              role="listbox"
              aria-label={label}
              className="overflow-y-auto overscroll-contain p-2"
            >
              {filteredOptions.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm font-bold text-ink">No options found</p>
                  <p className="mt-1 text-xs text-muted">Try a shorter search.</p>
                </div>
              ) : (
                filteredOptions.map((option, index) => {
                  const isSelected = option.value === value;
                  const isHighlighted = index === highlightedIndex;
                  return (
                    <button
                      id={`${listboxId}-${option.value}`}
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                        isHighlighted ? "bg-mist" : "hover:bg-mist/70"
                      }`}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      onClick={() => selectOption(option)}
                    >
                      <span
                        className={`grid size-6 shrink-0 place-items-center rounded-lg border ${
                          isSelected
                            ? "border-accent bg-accent text-white"
                            : "border-line bg-surface text-transparent"
                        }`}
                      >
                        <Check size={13} strokeWidth={3} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-ink">
                          {option.label}
                        </span>
                        {option.description && (
                          <span className="mt-0.5 block truncate text-xs text-muted">
                            {option.description}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
