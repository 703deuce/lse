"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  Grid3X3,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Swords,
  TrendingUp,
} from "lucide-react";
import {
  ModuleHeader,
  ModulePage,
  btnPrimary,
  btnSecondary,
  cardClass,
  cardPadding,
  cardGrid,
} from "@/components/ui/design-system";
import { cn } from "@/lib/utils";

export type MapsOverviewScan = {
  id: string;
  status: string;
  createdAt: string;
  finishedAt: string | null;
  keyword: string | null;
  keywordId: string | null;
  averageRank: number | null;
  top3Pct: number | null;
  top10Pct: number | null;
  visibilityScore: number | null;
  centerLabel: string | null;
  gridSize: number;
  radiusMeters: number;
};

export type MapsOverviewKeywordMovement = {
  keyword: string;
  keywordId: string;
  latestAvgRank: number | null;
  previousAvgRank: number | null;
  change: number | null;
  latestTop3Pct: number | null;
  latestScanId: string | null;
};

export type MapsOverviewDashboardProps = {
  businessId: string;
  businessName: string;
  latestScan: MapsOverviewScan | null;
  previousScan: MapsOverviewScan | null;
  keywordMovement: MapsOverviewKeywordMovement[];
  nextScheduledAt: string | null;
  topCompetitorLabels: string[];
};

function fmtRank(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return String(Math.round(n * 10) / 10);
}

function fmtPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${Math.round(n * 10) / 10}%`;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ChangeText({ value, invert }: { value: number | null; invert?: boolean }) {
  if (value == null || value === 0) {
    return <span className="text-zinc-400">No change</span>;
  }
  // For rank, lower is better → positive change text when value > 0 means improved
  const improved = invert ? value > 0 : value > 0;
  return (
    <span
      className={cn(
        "font-semibold tabular-nums",
        improved ? "text-[#027A48]" : "text-[#B42318]"
      )}
    >
      {value > 0 ? "+" : ""}
      {value}
      {invert ? " rank" : " pts"}
    </span>
  );
}

export function MapsOverviewDashboard({
  businessId,
  businessName,
  latestScan,
  previousScan,
  keywordMovement,
  nextScheduledAt,
  topCompetitorLabels,
}: MapsOverviewDashboardProps) {
  const scansHref = `/businesses/${businessId}/scans`;
  const campaignsHref = `/businesses/${businessId}/campaigns`;
  const keywordsHref = `/businesses/${businessId}/keywords`;
  const gridHref = latestScan
    ? `/businesses/${businessId}/grid/${latestScan.id}`
    : scansHref;

  const visibilityChange =
    latestScan?.top10Pct != null && previousScan?.top10Pct != null
      ? Math.round((latestScan.top10Pct - previousScan.top10Pct) * 10) / 10
      : latestScan?.visibilityScore != null && previousScan?.visibilityScore != null
        ? Math.round((latestScan.visibilityScore - previousScan.visibilityScore) * 10) / 10
        : null;

  const rankChange =
    latestScan?.averageRank != null && previousScan?.averageRank != null
      ? Math.round((previousScan.averageRank - latestScan.averageRank) * 10) / 10
      : null;

  return (
    <ModulePage>
      <ModuleHeader
        icon={MapPin}
        title="Maps Overview"
        subtitle={`Local visibility for ${businessName}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={gridHref} className={btnSecondary}>
              View grid
            </Link>
            <Link href={`/businesses/${businessId}/maps/setup`} className={btnPrimary}>
              <RefreshCw className="h-4 w-4" />
              Run scan
            </Link>
          </div>
        }
      />

      <section className={cn(cardClass, cardPadding)}>
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-[14px] font-semibold text-zinc-900">Latest visibility</h2>
            <p className="mt-0.5 text-[12px] text-zinc-500">
              {latestScan?.keyword
                ? `Keyword: ${latestScan.keyword}`
                : "Most recent usable Maps scan"}
            </p>
          </div>
          <div className="text-right text-[12px] text-zinc-500">
            <p>Last scan: {fmtDate(latestScan?.finishedAt ?? latestScan?.createdAt)}</p>
            <p className="mt-0.5 inline-flex items-center gap-1">
              <CalendarClock className="h-3.5 w-3.5" />
              Next scheduled:{" "}
              {nextScheduledAt ? fmtDate(nextScheduledAt) : "Not scheduled"}
            </p>
          </div>
        </div>

        <div className={cardGrid}>
          <Stat label="Avg rank" value={fmtRank(latestScan?.averageRank)} />
          <Stat label="Top 3" value={fmtPct(latestScan?.top3Pct)} />
          <Stat label="Top 10" value={fmtPct(latestScan?.top10Pct ?? latestScan?.visibilityScore)} />
          <Stat
            label="Visibility change"
            valueNode={
              <span className="text-lg font-bold text-zinc-900">
                <ChangeText value={visibilityChange} />
              </span>
            }
          />
        </div>

        {rankChange != null ? (
          <p className="mt-3 text-[12px] text-zinc-500">
            Average rank change vs prior scan:{" "}
            <ChangeText value={rankChange} invert />
          </p>
        ) : null}
      </section>

      <section className={cn(cardClass, cardPadding)}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-[14px] font-semibold text-zinc-900">Keyword movement</h2>
          <Link href={keywordsHref} className="text-[12px] font-semibold text-[#137752]">
            Manage keywords
          </Link>
        </div>
        {keywordMovement.length ? (
          <ul className="divide-y divide-zinc-100">
            {keywordMovement.slice(0, 6).map((k) => (
              <li
                key={k.keywordId}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[13px]"
              >
                <div className="min-w-0">
                  <p className="font-medium text-zinc-900">{k.keyword}</p>
                  <p className="text-[11px] text-zinc-500">
                    Avg rank {fmtRank(k.latestAvgRank)}
                    {k.latestTop3Pct != null ? ` · Top 3 ${fmtPct(k.latestTop3Pct)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <ChangeText value={k.change} invert />
                  {k.latestScanId ? (
                    <Link
                      href={`/businesses/${businessId}/grid/${k.latestScanId}`}
                      className="text-[12px] font-semibold text-[#137752]"
                    >
                      Grid
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-6 text-center text-[13px] text-zinc-500">
            Run scans for multiple keywords to see movement here.
          </p>
        )}
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className={cn(cardClass, cardPadding)}>
          <h2 className="flex items-center gap-2 text-[14px] font-semibold text-zinc-900">
            <TrendingUp className="h-4 w-4 text-[#137752]" />
            Geographic movement
          </h2>
          <p className="mt-2 text-[13px] leading-snug text-zinc-600">
            {latestScan
              ? `Your latest ${latestScan.gridSize}×${latestScan.gridSize} grid${
                  latestScan.centerLabel ? ` around ${latestScan.centerLabel}` : ""
                } shows where you hold or lose map-pack positions across nearby search points.`
              : "Geographic movement unlocks after your first Maps scan."}
          </p>
          {latestScan ? (
            <Link
              href={gridHref}
              className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-[#137752]"
            >
              Open visibility grid
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : null}
        </section>

        <section className={cn(cardClass, cardPadding)}>
          <h2 className="flex items-center gap-2 text-[14px] font-semibold text-zinc-900">
            <Swords className="h-4 w-4 text-[#137752]" />
            Competitor movement
          </h2>
          {topCompetitorLabels.length ? (
            <>
              <p className="mt-2 text-[13px] text-zinc-600">
                Businesses showing up most often in your latest grid:
              </p>
              <ul className="mt-2 space-y-1">
                {topCompetitorLabels.slice(0, 5).map((name) => (
                  <li key={name} className="text-[13px] font-medium text-zinc-800">
                    {name}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-2 text-[13px] text-zinc-600">
              Competitor movement appears after a scan finishes enriching grid competitors.
            </p>
          )}
          <Link
            href={`/businesses/${businessId}/maps/competitors`}
            className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-[#137752]"
          >
            View competitors
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </section>
      </div>

      <section className={cn(cardClass, cardPadding)}>
        <h2 className="text-[14px] font-semibold text-zinc-900">Actions</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={scansHref} className={btnSecondary}>
            <RefreshCw className="h-4 w-4" />
            Rerun keyword
          </Link>
          <Link href={keywordsHref} className={btnSecondary}>
            <Plus className="h-4 w-4" />
            Add keyword
          </Link>
          <Link href={scansHref} className={btnSecondary}>
            <Grid3X3 className="h-4 w-4" />
            Change grid
          </Link>
          <Link href={campaignsHref} className={btnSecondary}>
            <CalendarClock className="h-4 w-4" />
            Schedule
          </Link>
          <Link href={`/businesses/${businessId}/maps/profile`} className={btnSecondary}>
            <Search className="h-4 w-4" />
            GBP / profile
          </Link>
        </div>
      </section>
    </ModulePage>
  );
}

function Stat({
  label,
  value,
  valueNode,
}: {
  label: string;
  value?: string;
  valueNode?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
        {label}
      </p>
      {valueNode ?? (
        <p className="mt-1 text-xl font-bold tabular-nums text-zinc-900">{value}</p>
      )}
    </div>
  );
}
