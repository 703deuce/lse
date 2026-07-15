"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { gridEntityPillClass } from "@/components/scan/grid-rank-ui";
import { cn } from "@/lib/utils";

export type EntityOption = {
  key: string;
  label: string;
  isTarget?: boolean;
};

export type CompetitorAddOption = {
  key: string;
  label: string;
  placeId?: string | null;
  subtitle?: string | null;
};

type CompetitorGridToggleProps = {
  entities: EntityOption[];
  selectedKey: string;
  onSelect: (key: string) => void;
  /** Competitors from the scan that can still be added as chips. */
  addPool?: CompetitorAddOption[];
  onAdd?: (key: string) => void;
  /** When set, non-target chips in this set show a remove control. */
  removableKeys?: ReadonlySet<string> | string[];
  onRemove?: (key: string) => void;
  viewingLabel?: string;
  className?: string;
};

function asSet(keys?: ReadonlySet<string> | string[]): Set<string> {
  if (!keys) return new Set();
  return keys instanceof Set ? keys : new Set(keys);
}

export function CompetitorGridToggle({
  entities,
  selectedKey,
  onSelect,
  addPool = [],
  onAdd,
  removableKeys,
  onRemove,
  viewingLabel,
  className,
}: CompetitorGridToggleProps) {
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const removable = useMemo(() => asSet(removableKeys), [removableKeys]);

  const canAdd = Boolean(onAdd) && addPool.length > 0;
  const selected = entities.find((e) => e.key === selectedKey);
  const you = entities.find((e) => e.isTarget);

  useEffect(() => {
    if (!pickerOpen) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPickerOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [pickerOpen]);

  useEffect(() => {
    if (addPool.length === 0) setPickerOpen(false);
  }, [addPool.length]);

  const sortedPool = useMemo(
    () =>
      [...addPool].sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
      ),
    [addPool],
  );

  if (entities.length === 0) return null;

  return (
    <div ref={rootRef} className={cn("relative space-y-1.5", className)}>
      <div
        className="flex flex-wrap items-center gap-2"
        role="tablist"
        aria-label="Compare grids"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          View grid as
        </span>
        {entities.map((entity, i) => {
          const active = entity.key === selectedKey;
          const showRemove =
            Boolean(onRemove) && !entity.isTarget && removable.has(entity.key);
          return (
            <span key={entity.key} className="inline-flex items-center gap-0.5">
              <button
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onSelect(entity.key)}
                className={gridEntityPillClass(active)}
                title={entity.label}
              >
                {entity.isTarget ? "You" : entity.label || `Competitor ${i}`}
              </button>
              {showRemove ? (
                <button
                  type="button"
                  onClick={() => onRemove?.(entity.key)}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 transition hover:bg-red-50 hover:text-red-600"
                  aria-label={`Remove ${entity.label}`}
                  title="Remove"
                >
                  <X className="h-3 w-3" strokeWidth={2.25} />
                </button>
              ) : null}
            </span>
          );
        })}

        <div className="relative">
          <button
            type="button"
            disabled={!canAdd}
            onClick={() => {
              if (!canAdd) return;
              setPickerOpen((o) => !o);
            }}
            title={
              canAdd
                ? "Add a competitor from this scan"
                : "More competitors appear as points finish scanning"
            }
            aria-label="Add competitor grid"
            aria-expanded={pickerOpen}
            aria-controls={pickerOpen ? panelId : undefined}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border border-dashed px-2.5 py-0.5 text-[12px] transition",
              canAdd
                ? "border-border bg-surface text-text-muted hover:border-zinc-400 hover:text-zinc-800"
                : "cursor-not-allowed border-border bg-surface text-text-muted opacity-60",
            )}
          >
            <Plus className="h-3 w-3" /> Add Competitor
          </button>

          {pickerOpen && canAdd ? (
            <div
              id={panelId}
              role="listbox"
              aria-label="Add competitor"
              className="absolute left-0 top-[calc(100%+0.4rem)] z-40 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_12px_40px_-16px_rgba(15,23,42,0.28)]"
            >
              <div className="border-b border-zinc-100 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">
                  From this scan
                </p>
                <p className="mt-0.5 text-[11px] text-zinc-500">
                  Top places nearby — add any to compare grids.
                </p>
              </div>
              <ul className="max-h-56 overflow-y-auto py-1">
                {sortedPool.map((opt) => (
                  <li key={opt.key}>
                    <button
                      type="button"
                      role="option"
                      className="flex w-full flex-col gap-0.5 px-3 py-2 text-left transition hover:bg-zinc-50"
                      onClick={() => {
                        onAdd?.(opt.key);
                        setPickerOpen(false);
                      }}
                    >
                      <span className="truncate text-[12px] font-semibold text-zinc-900">
                        {opt.label}
                      </span>
                      {opt.subtitle ? (
                        <span className="truncate text-[10px] text-zinc-400">
                          {opt.subtitle}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      {selected && !selected.isTarget && you ? (
        <p className="text-[11px] text-text-muted">
          Viewing: <strong>{viewingLabel ?? selected.label}</strong>
          {" · "}
          <button
            type="button"
            onClick={() => onSelect(you.key)}
            className="text-primary hover:underline"
          >
            Back to You
          </button>
        </p>
      ) : null}
    </div>
  );
}
