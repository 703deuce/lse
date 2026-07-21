"use client";

import type { ReactNode } from "react";
import { Loader2, Zap } from "lucide-react";
import type { MomentumLabel } from "@/lib/reviews/metrics";
import {
  ContentCard,
  ModuleHeader,
  SectionTitle,
  btnPrimary,
  btnSecondary,
  tableHeadClass,
} from "@/components/ui/design-system";
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
      subtitle="Whether review growth is consistent — or a one-time spike."
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

export const momentumCardClass =
  "rounded-md border border-zinc-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]";

export function MomentumSectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return <SectionTitle title={title} subtitle={subtitle} action={action} />;
}

export function MomentumPanel({ className, children }: { className?: string; children: ReactNode }) {
  return <ContentCard className={className}>{children}</ContentCard>;
}

export function MomentumTableShell({ children }: { children: ReactNode }) {
  return (
    <ContentCard padding={false} className="overflow-hidden">
      <div className="border-b border-zinc-100 px-4 py-3">
        <h3 className="text-base font-semibold tracking-tight text-zinc-900">Competitor comparison</h3>
        <p className="mt-0.5 text-xs text-zinc-500">How your velocity stacks up against tracked competitors.</p>
      </div>
      {children}
    </ContentCard>
  );
}

export function momentumTableHeadClass() {
  return cn(tableHeadClass, "px-4 py-2.5 text-left");
}
