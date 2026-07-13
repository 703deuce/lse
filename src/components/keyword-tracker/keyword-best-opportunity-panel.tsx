"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ExternalLink, Sparkles } from "lucide-react";
import { dashboardCard, dashboardCardTitle, dashboardMicro } from "@/components/overview/dashboard-ui";
import { formatTimeAgo } from "@/lib/keyword-tracker/visibility";
import { cn } from "@/lib/utils";

type RankPoint = {
  rank: number | null;
  checked_at: string;
};

type BestKeyword = {
  id: string;
  keyword: string;
  opportunity: number;
  search_volume: number | null;
  latest_check: { rank: number | null; visibility_score: number; checked_at?: string } | null;
  recent_checks: RankPoint[];
};

export function KeywordBestOpportunityPanel({ keyword }: { keyword: BestKeyword | null }) {
  if (!keyword) {
    return (
      <div className={cn(dashboardCard, "px-3.5 py-8 text-center")}>
        <p className="text-[13px] text-zinc-500">No opportunity data yet. Add keywords and run a check.</p>
      </div>
    );
  }

  const scorePct = Math.min(100, keyword.opportunity);
  const excellent = scorePct >= 80;

  const chartData = [...keyword.recent_checks]
    .reverse()
    .map((c) => ({
      date: new Date(c.checked_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      rank: c.rank != null && c.rank > 0 ? c.rank : 21,
    }));

  if (chartData.length < 2 && keyword.latest_check) {
    chartData.push({
      date: "Now",
      rank: keyword.latest_check.rank != null && keyword.latest_check.rank > 0 ? keyword.latest_check.rank : 21,
    });
  }

  return (
    <div className={cn(dashboardCard, "overflow-hidden")}>
      <div className="border-b border-zinc-100 px-3.5 py-2.5">
        <div className="flex items-center gap-1.5 text-emerald-700">
          <Sparkles className="h-3.5 w-3.5" />
          <h3 className={dashboardCardTitle}>Best Opportunity</h3>
        </div>
        <p className="mt-1.5 text-[13px] font-semibold text-zinc-900">{keyword.keyword}</p>
        <p className={cn("mt-1", dashboardMicro)}>
          This keyword has high potential to break into the top 3 results with focused optimization.
        </p>
      </div>

      <div className="space-y-3.5 p-3.5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Opportunity Score</p>
          <div className="mt-2 flex items-center gap-3">
            <div className="relative h-14 w-14 shrink-0">
              <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90">
                <circle cx="18" cy="18" r="15" fill="none" stroke="#e4e4e7" strokeWidth="3" />
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="3"
                  strokeDasharray={`${(scorePct / 100) * 94} 94`}
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div>
              <p className="text-base font-bold tabular-nums leading-none text-zinc-900">
                {scorePct}
                <span className="text-[11px] font-medium text-zinc-400"> / 100</span>
              </p>
              {excellent && (
                <span className="mt-1 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                  Excellent
                </span>
              )}
            </div>
          </div>
        </div>

        {chartData.length > 0 ? (
          <div>
            <p className={dashboardCardTitle}>Rank History</p>
            <p className={dashboardMicro}>Last 30 days</p>
            <div className="mt-2 h-28">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#71717a" }} interval="preserveStartEnd" />
                  <YAxis reversed tick={{ fontSize: 10, fill: "#71717a" }} width={28} domain={[1, 30]} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="rank"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.15}
                    strokeWidth={2}
                    dot={{ r: 2.5, fill: "#10b981" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {keyword.latest_check?.checked_at && (
              <p className="mt-1 text-[10px] text-zinc-400">Updated {formatTimeAgo(keyword.latest_check.checked_at)}</p>
            )}
          </div>
        ) : (
          <div>
            <p className={dashboardCardTitle}>Rank History</p>
            <p className={dashboardMicro}>Last 30 days</p>
            <div className="mt-2 flex h-28 items-center justify-center rounded-lg border border-dashed border-zinc-200 bg-zinc-50 text-[11px] text-zinc-400">
              Run a keyword check to see rank history
            </div>
          </div>
        )}

        <p className={cn("leading-snug", dashboardMicro)}>
          Optimize your Google Business Profile, build relevant local citations, and encourage more reviews to
          improve rankings.
        </p>

        <button
          type="button"
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-emerald-700"
        >
          View Optimization Tips
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
