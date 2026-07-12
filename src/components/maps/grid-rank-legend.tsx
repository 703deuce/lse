"use client";

import type { GridColorMode } from "@/lib/maps/colors";
import { legendItems } from "@/lib/maps/colors";
import { cn } from "@/lib/utils";

export function GridRankLegend({
  mode,
  onModeChange,
  className,
  showModeToggle = true,
}: {
  mode: GridColorMode;
  onModeChange: (mode: GridColorMode) => void;
  className?: string;
  showModeToggle?: boolean;
}) {
  const items = legendItems(mode);

  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-x-3 gap-y-1", className)}>
      {showModeToggle && (
        <div className="mr-2 flex items-center gap-0.5 rounded-md border border-border bg-surface-subtle p-0.5 text-[11px]">
          <button
            type="button"
            onClick={() => onModeChange("strict")}
            className={cn(
              "rounded px-2 py-0.5 font-medium transition-colors",
              mode === "strict"
                ? "bg-white text-text shadow-sm"
                : "text-text-muted hover:text-text"
            )}
          >
            Strict
          </button>
          <button
            type="button"
            onClick={() => onModeChange("falcon")}
            className={cn(
              "rounded px-2 py-0.5 font-medium transition-colors",
              mode === "falcon"
                ? "bg-white text-text shadow-sm"
                : "text-text-muted hover:text-text"
            )}
          >
            Local Falcon
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-[11px] text-text-muted">
        {items.map((item) => (
          <span key={item.label} className="flex items-center gap-1">
            <span
              className="inline-block h-3 w-3 rounded-full border border-white shadow-sm"
              style={{ background: item.hex }}
            />
            {item.label}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-3 w-3 rounded-full border border-white shadow-sm"
            style={{ background: "#ef4444" }}
          />
          20+
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full border border-border bg-white shadow-sm" />
          Not found
        </span>
      </div>
    </div>
  );
}
