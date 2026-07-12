import { cn } from "@/lib/utils";
import type { MatchStatus } from "@/lib/audit/types";

const styles: Record<MatchStatus, string> = {
  match: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200",
  partial: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
  missing: "bg-surface-subtle text-text-muted dark:bg-zinc-800 dark:text-zinc-300",
  mismatch: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200",
};

export function MatchStatusBadge({ status }: { status: MatchStatus }) {
  const label = status === "match" ? "Match" : status === "partial" ? "Partial Match" : status === "missing" ? "Missing" : "Mismatch";
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize", styles[status])}>
      {label}
    </span>
  );
}
