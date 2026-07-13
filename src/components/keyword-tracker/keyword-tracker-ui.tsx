"use client";

import type { ComponentType, ReactNode } from "react";
import { AlertTriangle, Bell, ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import {
  dashboardCard,
  dashboardControl,
  dashboardMicro,
  dashboardSectionLabel,
} from "@/components/overview/dashboard-ui";
import { cn } from "@/lib/utils";
import { ModuleHeader, btnIcon, btnSecondary } from "@/components/ui/design-system";

export function KeywordsPageHeader({ businessId }: { businessId: string }) {
  return (
    <ModuleHeader
      title="Maps Keywords"
      subtitle="Track Google Maps ranking performance for your most important local search terms."
      className="[&_h1]:text-xl [&_p]:text-[13px] [&_p]:leading-snug"
      actions={
        <>
          <button type="button" className={cn(btnIcon, "relative h-9 w-9 text-zinc-600")} aria-label="Notifications">
            <Bell className="h-3.5 w-3.5" />
            <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-emerald-600 px-0.5 text-[9px] font-bold text-white">
              3
            </span>
          </button>
          <button type="button" className={cn(btnSecondary, "h-9 gap-1.5 px-2.5 text-[13px]")}>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-600 text-[11px] font-bold text-white">
              JD
            </span>
            <span className="hidden sm:inline">John Doe</span>
            <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
          </button>
          <Link href={`/businesses/${businessId}/workspace`} className={cn(btnSecondary, "h-9 px-3 text-[13px]")}>
            ← Maps Workspace
          </Link>
        </>
      }
    />
  );
}

export function KeywordsMarketBanner({
  ready,
  display,
}: {
  ready: boolean;
  display?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3.5 py-2.5 text-[13px] leading-snug",
        ready
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-amber-200 bg-amber-50 text-amber-950"
      )}
    >
      <AlertTriangle className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", ready ? "text-emerald-600" : "text-amber-600")} />
      {ready ? (
        <p>
          <strong>Volume market:</strong> {display} — from your GMB address, used for all keywords including
          &ldquo;near me&rdquo;. Rank checks use your business map pin.
        </p>
      ) : (
        <p>
          <strong>Could not resolve volume market.</strong> Your GMB address should include city and state (e.g.
          Woodbridge, VA). We convert that to a Google Ads market code for local search volume.
        </p>
      )}
    </div>
  );
}

function MiniSparkline({ points }: { points: number[] }) {
  if (points.length < 2) {
    return (
      <svg viewBox="0 0 64 24" className="h-5 w-14 text-emerald-500" aria-hidden>
        <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points="0,18 16,14 32,10 48,8 64,4" />
      </svg>
    );
  }
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const coords = points
    .map((v, i) => {
      const x = (i / (points.length - 1)) * 64;
      const y = 22 - ((v - min) / range) * 18;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 64 24" className="h-5 w-14 text-emerald-500" aria-hidden>
      <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={coords} />
    </svg>
  );
}

function TrendLine({
  delta,
  label,
  invert = false,
}: {
  delta: number | null;
  label: string;
  invert?: boolean;
}) {
  if (delta == null || delta === 0) return null;
  const improved = delta > 0;
  const arrow = invert ? (improved ? "↓" : "↑") : improved ? "↑" : "↓";
  return (
    <p className={cn("mt-0.5 text-[11px] font-medium", improved ? "text-emerald-600" : "text-red-600")}>
      {arrow} {Math.abs(delta)} {label}
    </p>
  );
}

export function KeywordsKpiCard({
  label,
  value,
  sub,
  icon: Icon,
  trend,
  trendLabel,
  invertTrend,
  sparkPoints,
  showChevron,
  isKeywordValue,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: ComponentType<{ className?: string }>;
  trend?: number | null;
  trendLabel?: string;
  invertTrend?: boolean;
  sparkPoints?: number[];
  showChevron?: boolean;
  isKeywordValue?: boolean;
}) {
  return (
    <div className={cn(dashboardCard, "rounded-lg px-2.5 py-1.5")}>
      <div className="flex items-start justify-between gap-1.5">
        <div className="min-w-0 flex-1">
          <p className={dashboardSectionLabel}>{label}</p>
          {isKeywordValue ? (
            <p className="mt-0.5 truncate text-[13px] font-semibold text-emerald-700">{value}</p>
          ) : (
            <p className="mt-0.5 text-base font-bold tabular-nums leading-none text-zinc-900">{value}</p>
          )}
          {sub && (
            <p className={cn("mt-0.5", dashboardMicro, isKeywordValue && "font-medium text-zinc-600")}>{sub}</p>
          )}
          {trendLabel && <TrendLine delta={trend ?? null} label={trendLabel} invert={invertTrend} />}
        </div>
        <div className="flex shrink-0 items-start gap-1">
          <div className="flex flex-col items-end gap-1">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
              <Icon className="h-2.5 w-2.5" />
            </span>
            {sparkPoints && sparkPoints.length > 0 && <MiniSparkline points={sparkPoints} />}
          </div>
          {showChevron && <ChevronRight className="mt-1 h-4 w-4 text-zinc-300" aria-hidden />}
        </div>
      </div>
    </div>
  );
}

export function VisibilityBar({ score }: { score: number | null | undefined }) {
  if (score == null) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="h-1.5 w-16 rounded-full bg-zinc-100" />
        <span className="text-[11px] text-zinc-400">—</span>
      </div>
    );
  }
  const v = Math.round(Number(score));
  const color = v >= 70 ? "bg-emerald-500" : v >= 30 ? "bg-amber-400" : "bg-zinc-300";
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-100">
        <div className={`h-full ${color}`} style={{ width: `${v}%` }} />
      </div>
      <span className="w-8 text-right text-[11px] font-medium tabular-nums text-zinc-700">{v}%</span>
    </div>
  );
}

export function KeywordsPanel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(dashboardCard, className)}>{children}</div>;
}

export { dashboardControl as keywordsControlClass };
