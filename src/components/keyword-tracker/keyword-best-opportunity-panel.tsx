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
import { formatTimeAgo } from "@/lib/keyword-tracker/visibility";

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
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-zinc-500">No opportunity data yet. Add keywords and run a check.</p>
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
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-100 px-5 py-4">
        <div className="flex items-center gap-2 text-emerald-700">
          <Sparkles className="h-4 w-4" />
          <h3 className="text-sm font-semibold">Best Opportunity</h3>
        </div>
        <p className="mt-2 text-base font-semibold text-zinc-900">{keyword.keyword}</p>
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">
          This keyword has high potential to break into the top 3 results with focused optimization.
        </p>
      </div>

      <div className="space-y-5 p-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Opportunity Score</p>
          <div className="mt-3 flex items-center gap-4">
            <div className="relative h-[72px] w-[72px] shrink-0">
              <svg viewBox="0 0 36 36" className="h-[72px] w-[72px] -rotate-90">
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
              <p className="text-3xl font-bold tabular-nums text-zinc-900">
                {scorePct}
                <span className="text-lg font-normal text-zinc-400"> / 100</span>
              </p>
              {excellent && (
                <span className="mt-1 inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                  Excellent
                </span>
              )}
            </div>
          </div>
        </div>

        {chartData.length > 0 ? (
          <div>
            <p className="text-sm font-semibold text-zinc-900">Rank History</p>
            <p className="text-xs text-zinc-500">Last 30 days</p>
            <div className="mt-3 h-36">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#71717a" }} interval="preserveStartEnd" />
                  <YAxis reversed tick={{ fontSize: 10, fill: "#71717a" }} width={32} domain={[1, 30]} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="rank"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.15}
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#10b981" }}
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
            <p className="text-sm font-semibold text-zinc-900">Rank History</p>
            <p className="text-xs text-zinc-500">Last 30 days</p>
            <div className="mt-3 flex h-36 items-center justify-center rounded-lg border border-dashed border-zinc-200 bg-zinc-50 text-xs text-zinc-400">
              Run a keyword check to see rank history
            </div>
          </div>
        )}

        <p className="text-xs leading-relaxed text-zinc-500">
          Optimize your Google Business Profile, build relevant local citations, and encourage more reviews to
          improve rankings.
        </p>

        <button
          type="button"
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
        >
          View Optimization Tips
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
