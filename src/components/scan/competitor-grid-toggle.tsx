"use client";

import { Plus } from "lucide-react";
import { gridEntityPillClass } from "@/components/scan/grid-rank-ui";
import { cn } from "@/lib/utils";

export type EntityOption = {
  key: string;
  label: string;
  isTarget?: boolean;
};

interface CompetitorGridToggleProps {
  entities: EntityOption[];
  selectedKey: string;
  onSelect: (key: string) => void;
  viewingLabel?: string;
  className?: string;
}

export function CompetitorGridToggle({
  entities,
  selectedKey,
  onSelect,
  viewingLabel,
  className,
}: CompetitorGridToggleProps) {
  const selected = entities.find((e) => e.key === selectedKey);
  const you = entities.find((e) => e.isTarget);

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          View grid as
        </span>
        {entities.map((entity, i) => (
          <button
            key={entity.key}
            type="button"
            onClick={() => onSelect(entity.key)}
            className={gridEntityPillClass(selectedKey === entity.key)}
          >
            {entity.isTarget ? "You" : entity.label || `Competitor ${i}`}
          </button>
        ))}
        <button
          type="button"
          disabled
          title="Add competitor from Cell Inspector fingerprint"
          className="inline-flex items-center gap-1 rounded-md border border-dashed border-border bg-surface px-2.5 py-0.5 text-[12px] text-text-muted"
        >
          <Plus className="h-3 w-3" /> Add Competitor
        </button>
      </div>
      {selected && !selected.isTarget && you && (
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
      )}
    </div>
  );
}
