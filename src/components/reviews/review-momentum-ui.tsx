"use client";

import type { ReactNode } from "react";
import { Loader2, Zap } from "lucide-react";
import type { MomentumLabel } from "@/lib/reviews/metrics";
import {
  dashboardCard,
  dashboardSectionLabel,
} from "@/components/overview/dashboard-ui";
import { ModuleHeader, btnPrimary, btnSecondary } from "@/components/ui/design-system";
import { cn } from "@/lib/utils";

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
      title="Review Momentum"
      className="[&_h1]:text-xl [&_p]:text-[13px] [&_p]:leading-snug"
      meta={
        <p className="text-[11px] text-zinc-400">
          90-day trend shows whether growth is consistent or a one-time spike.
        </p>
      }
    />
  );
}

export function MomentumTopBar({
  running,
  onRun,
  businessId,
}: {
  running: boolean;
  onRun: () => void;
  businessId?: string;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onRun}
        disabled={running}
        className={cn(btnPrimary, "h-9 px-3.5 text-[13px]")}
      >
        {running ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Zap className="h-3.5 w-3.5 fill-current" />
        )}
        Run Momentum Audit
      </button>
      {businessId ? (
        <>
          <a
            href={`/businesses/${businessId}/review-requests`}
            className={cn(btnSecondary, "h-9 px-3 text-[13px]")}
          >
            Open Review Requests
          </a>
          <button
            type="button"
            className={cn(btnSecondary, "h-9 px-3 text-[13px]")}
            onClick={() => {
              void import("@/lib/journey/report-staging").then(({ stageReportItem }) => {
                stageReportItem({
                  businessId,
                  source: "reviews",
                  title: "Review momentum insight",
                  href: `/businesses/${businessId}/reviews/momentum`,
                });
              });
            }}
          >
            Add to report
          </button>
        </>
      ) : null}
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
      return "border border-emerald-200 bg-emerald-50 text-emerald-700";
    case "Slowing":
    case "Dormant":
      return "bg-zinc-100 text-zinc-600";
    default:
      return "bg-zinc-100 text-zinc-600";
  }
}

export const momentumCardClass = dashboardCard;

export function MomentumSectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-2.5 flex items-start justify-between gap-2">
      <div>
        <h3 className="text-[13px] font-semibold tracking-tight text-zinc-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[11px] leading-snug text-zinc-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function MomentumPanel({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn(dashboardCard, "p-3.5", className)}>{children}</div>;
}

export function MomentumTableShell({ children }: { children: ReactNode }) {
  return (
    <div className={cn(dashboardCard, "overflow-hidden p-0")}>
      <div className="border-b border-zinc-100 px-3.5 py-2.5">
        <h3 className="text-[13px] font-semibold text-zinc-900">Competitor comparison</h3>
      </div>
      {children}
    </div>
  );
}

export function momentumTableHeadClass() {
  return cn(dashboardSectionLabel, "px-3.5 py-2 text-left font-semibold");
}
