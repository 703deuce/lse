"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { btnSecondary } from "@/components/ui/design-system";
import { cn } from "@/lib/utils";

/** Show first `pageSize` items, then expand/collapse. Default 5. */
export function ShowMoreList({
  items,
  pageSize = 5,
  className,
  renderItem,
  empty,
}: {
  items: ReactNode[] | unknown[];
  pageSize?: number;
  className?: string;
  renderItem?: (item: unknown, index: number) => ReactNode;
  empty?: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const total = items.length;
  const visible = useMemo(() => {
    if (expanded || total <= pageSize) return items;
    return items.slice(0, pageSize);
  }, [expanded, items, pageSize, total]);

  if (total === 0) return <>{empty ?? null}</>;

  return (
    <div className={cn("space-y-2", className)}>
      {renderItem
        ? (visible as unknown[]).map((item, i) => renderItem(item, i))
        : (visible as ReactNode[])}
      {total > pageSize ? (
        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className={cn(btnSecondary, "h-8 gap-1.5 px-3 text-xs")}
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                Show {total - pageSize} more
              </>
            )}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Client-side page controls for lists (5 per page by default). */
export function ClientPager({
  page,
  pageSize = 5,
  total,
  onPageChange,
}: {
  page: number;
  pageSize?: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  const current = Math.min(Math.max(1, page), totalPages);
  const from = (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-600">
      <span className="text-xs tabular-nums text-zinc-500">
        Showing {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={current <= 1}
          onClick={() => onPageChange(current - 1)}
          className={cn(btnSecondary, "h-8 px-3 text-xs disabled:opacity-50")}
        >
          Previous
        </button>
        <span className="text-xs font-medium tabular-nums text-zinc-500">
          Page {current} of {totalPages}
        </span>
        <button
          type="button"
          disabled={current >= totalPages}
          onClick={() => onPageChange(current + 1)}
          className={cn(btnSecondary, "h-8 px-3 text-xs disabled:opacity-50")}
        >
          Next
        </button>
      </div>
    </div>
  );
}
