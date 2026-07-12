"use client";

import { Calendar, ChevronDown, Loader2, Zap } from "lucide-react";
import type { MomentumLabel } from "@/lib/reviews/metrics";
import {
  ModuleHeader,
  ContentCard,
  cardClass,
  btnPrimary,
  btnSecondary,
} from "@/components/ui/design-system";

export function formatPace(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function formatChartDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function MomentumPageHeader() {
  return (
    <ModuleHeader
      title="Review Momentum™"
      subtitle="Primary score based on 30-day review velocity — not total review count. 7-day counts are exact; days 8–30 use weekly buckets."
      meta={
        <p className="text-xs text-zinc-400">
          90-Day Trend: Are they consistently gaining reviews, or was it just a random spike?
        </p>
      }
    />
  );
}

export function MomentumTopBar({
  running,
  onRun,
}: {
  running: boolean;
  onRun: () => void;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      <button type="button" className={btnSecondary}>
        <Calendar className="h-3.5 w-3.5 text-zinc-500" />
        Last 30 Days
        <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
      </button>
      <button
        type="button"
        onClick={onRun}
        disabled={running}
        className={btnPrimary}
      >
        {running ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Zap className="h-3.5 w-3.5 fill-current" />
        )}
        Run Momentum Audit
      </button>
    </div>
  );
}

export function momentumTableBadge(label: MomentumLabel): string {
  switch (label) {
    case "Accelerating":
    case "Exploding":
      return "bg-emerald-600 text-white";
    case "Healthy":
    case "Stable":
      return "border border-emerald-300 bg-white text-emerald-700";
    case "Slowing":
    case "Dormant":
      return "bg-zinc-100 text-zinc-600";
    default:
      return "bg-zinc-100 text-zinc-600";
  }
}

export const momentumCardClass = cardClass;

export function MomentumCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <ContentCard padding={false} className={className}>
      {children}
    </ContentCard>
  );
}
