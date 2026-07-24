"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus, Play } from "lucide-react";
import { MockMetricCard, MockPageHeader, mock } from "@/components/mockup/ui";
import {
  VisibilityHeatmap,
  type HeatmapRankCell,
} from "@/components/maps/visibility-heatmap";
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
  heatmapCells: HeatmapRankCell[];
  keywordsTracked: number;
};

function fmtRank(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return String(Math.round(n * 10) / 10);
}

function fmtPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${Math.round(n)}%`;
}

function RankChange({ value }: { value: number | null }) {
  if (value == null || value === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[#98A2B3]">
        <Minus className="h-3.5 w-3.5" />
        —
      </span>
    );
  }
  const improved = value > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 font-semibold tabular-nums",
        improved ? "text-[#027A48]" : "text-[#B42318]"
      )}
    >
      {improved ? (
        <ArrowUpRight className="h-3.5 w-3.5" />
      ) : (
        <ArrowDownRight className="h-3.5 w-3.5" />
      )}
      {Math.abs(value)}
    </span>
  );
}

export function MapsOverviewDashboard({
  businessId,
  businessName,
  latestScan,
  keywordMovement,
  heatmapCells,
  keywordsTracked,
}: MapsOverviewDashboardProps) {
  const setupHref = `/businesses/${businessId}/maps/setup`;
  const gridHref = latestScan
    ? `/businesses/${businessId}/grid/${latestScan.id}`
    : `/businesses/${businessId}/scans`;

  const top3Count =
    latestScan?.top3Pct != null && latestScan.gridSize
      ? Math.round((latestScan.top3Pct / 100) * latestScan.gridSize * latestScan.gridSize)
      : null;
  const top10Count =
    latestScan?.top10Pct != null && latestScan.gridSize
      ? Math.round((latestScan.top10Pct / 100) * latestScan.gridSize * latestScan.gridSize)
      : null;

  return (
    <div className={mock.page}>
      <MockPageHeader
        title="Maps Overview"
        subtitle={`Local ranking visibility for ${businessName}`}
        actions={
          <Link href={setupHref} className={mock.btnPrimary}>
            <Play className="h-4 w-4 fill-current" />
            Run New Scan
          </Link>
        }
      />

      {/* KPI row */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MockMetricCard label="Keywords Tracked" value={keywordsTracked || "—"} />
        <MockMetricCard
          label="Top 3 Rankings"
          value={top3Count != null ? top3Count : fmtPct(latestScan?.top3Pct)}
          hint={latestScan?.top3Pct != null ? `${fmtPct(latestScan.top3Pct)} of grid` : undefined}
        />
        <MockMetricCard
          label="Top 10 Rankings"
          value={top10Count != null ? top10Count : fmtPct(latestScan?.top10Pct)}
          hint={
            latestScan?.top10Pct != null ? `${fmtPct(latestScan.top10Pct)} of grid` : undefined
          }
        />
        <MockMetricCard label="Avg. Rank" value={fmtRank(latestScan?.averageRank)} />
        <MockMetricCard
          label="Visibility Score"
          value={
            latestScan?.visibilityScore != null
              ? Math.round(latestScan.visibilityScore)
              : fmtPct(latestScan?.top10Pct)
          }
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        {/* Heatmap */}
        <section className={cn(mock.card, "p-5 xl:col-span-3")}>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-[16px] font-semibold text-[#101828]">Local Ranking Heatmap</h2>
              <p className="mt-0.5 text-[13px] text-[#667085]">
                {latestScan?.keyword
                  ? `“${latestScan.keyword}” · ${latestScan.gridSize}×${latestScan.gridSize} grid`
                  : "Latest scan grid"}
              </p>
            </div>
            <Link href={gridHref} className={mock.link}>
              Open full grid →
            </Link>
          </div>
          {heatmapCells.length > 0 ? (
            <VisibilityHeatmap
              cells={heatmapCells}
              gridSize={latestScan?.gridSize ?? 7}
            />
          ) : (
            <div className="flex min-h-[240px] flex-col items-center justify-center rounded-xl border border-dashed border-[#E6EAF0] bg-[#F9FAFB] px-4 text-center">
              <p className="text-sm text-[#667085]">No grid ranks yet for this scan.</p>
              <Link href={setupHref} className={cn(mock.btnPrimary, "mt-3")}>
                Run New Scan
              </Link>
            </div>
          )}
        </section>

        {/* Keyword performance */}
        <section className={cn(mock.card, "overflow-hidden xl:col-span-2")}>
          <div className="flex items-center justify-between border-b border-[#E6EAF0] px-5 py-4">
            <h2 className="text-[16px] font-semibold text-[#101828]">Keyword Performance</h2>
            <Link
              href={`/businesses/${businessId}/keywords`}
              className={mock.link}
            >
              Manage
            </Link>
          </div>
          {keywordMovement.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[280px]">
                <thead>
                  <tr className={mock.tableHead}>
                    <th className="px-5 py-2.5">Keyword</th>
                    <th className="px-3 py-2.5 text-right">Avg. Rank</th>
                    <th className="px-5 py-2.5 text-right">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {keywordMovement.slice(0, 8).map((k) => (
                    <tr key={k.keywordId} className="border-t border-[#F2F4F7]">
                      <td className="px-5 py-3.5">
                        {k.latestScanId ? (
                          <Link
                            href={`/businesses/${businessId}/grid/${k.latestScanId}`}
                            className="text-sm font-medium text-[#101828] hover:text-[#137752]"
                          >
                            {k.keyword}
                          </Link>
                        ) : (
                          <span className="text-sm font-medium text-[#101828]">{k.keyword}</span>
                        )}
                      </td>
                      <td className="px-3 py-3.5 text-right text-sm font-semibold tabular-nums text-[#344054]">
                        {fmtRank(k.latestAvgRank)}
                      </td>
                      <td className="px-5 py-3.5 text-right text-sm">
                        <RankChange value={k.change} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-5 py-10 text-center text-sm text-[#667085]">
              Run scans for your keywords to see performance here.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
