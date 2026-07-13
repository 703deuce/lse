"use client";

import { useMemo, useState } from "react";
import { Download, MoreHorizontal, Search, Shield, ShieldAlert, Star } from "lucide-react";
import { ENGINE_LABELS, type AggregateMetrics, type AiEngine, type HistoricalMentionRow, type MentionLeaderboardRow } from "@/lib/ai-visibility/types";
import { AiKpiCard, AiPanel, EngineIconRow, Sparkles, TrendingUp } from "@/components/ai-visibility/ai-visibility-ui";
import type { MentionsViewMode } from "@/components/ai-visibility/ai-visibility-ui";
import { cn } from "@/lib/utils";

function statusFromShare(pct: number): { label: string; className: string; Icon: typeof Shield } {
  if (pct >= 60) return { label: "Strong", className: "bg-emerald-100 text-emerald-800", Icon: Shield };
  if (pct >= 30) return { label: "Moderate", className: "bg-amber-100 text-amber-800", Icon: Star };
  return { label: "Weak", className: "bg-red-100 text-red-800", Icon: ShieldAlert };
}

function posColor(pos: number | null): string {
  if (pos == null) return "text-text-muted";
  if (pos <= 3) return "text-primary";
  if (pos <= 7) return "text-amber-600";
  return "text-red-600";
}

function TrendSparkline({ seed }: { seed: number }) {
  const points = [8, 12 + (seed % 4), 10, 16 - (seed % 3), 14, 18 + (seed % 2)];
  const colors = ["#16A34A", "#8b5cf6", "#0ea5e9", "#f59e0b"];
  const coords = points.map((v, i) => `${(i / (points.length - 1)) * 56},${22 - v}`).join(" ");
  return (
    <svg viewBox="0 0 56 24" className="h-5 w-14" aria-hidden>
      <polyline fill="none" stroke={colors[seed % colors.length]} strokeWidth="1.5" points={coords} />
    </svg>
  );
}

export function AiVisibilityMentionsTab({
  isCombined,
  leaderboard,
  historicalMentions,
  recentRunCount,
  search,
  aggregate,
  targetRow,
  trendSpark,
  enginesMentioning,
  targetEngines,
  mentionsMode,
}: {
  isCombined: boolean;
  leaderboard: MentionLeaderboardRow[];
  historicalMentions: HistoricalMentionRow[];
  recentRunCount: number;
  search: string;
  aggregate?: AggregateMetrics;
  targetRow?: HistoricalMentionRow | MentionLeaderboardRow;
  trendSpark: number[];
  enginesMentioning: number;
  targetEngines: AiEngine[];
  mentionsMode?: MentionsViewMode;
}) {
  const [localSearch, setLocalSearch] = useState(search);
  const [engineFilter, setEngineFilter] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const showCombined = isCombined || mentionsMode === "across";

  const rows = useMemo(() => {
    if (showCombined) {
      return historicalMentions.map((h) => ({
        key: h.normalizedName,
        name: h.displayName,
        isTarget: h.isTargetBrand,
        runShare: `${h.runCount}/${h.totalRuns}`,
        sharePct: h.sharePct,
        engines: [] as AiEngine[],
        avgPosition: null as number | null,
        lastSeen: h.lastSeenAt,
      }));
    }
    return leaderboard.map((l) => ({
      key: l.normalizedName,
      name: l.displayName,
      isTarget: l.isTargetBrand,
      runShare: `${l.engineCount}/${l.totalEngines}`,
      sharePct: l.sharePct,
      engines: l.engines,
      avgPosition: l.avgPosition,
      lastSeen: null as string | null,
    }));
  }, [showCombined, leaderboard, historicalMentions]);

  const filtered = rows.filter((r) => {
    const q = (localSearch || search).trim().toLowerCase();
    if (q && !r.name.toLowerCase().includes(q)) return false;
    if (engineFilter !== "all" && !r.engines.includes(engineFilter as AiEngine)) return false;
    if (mentionsMode === "by-engine" && engineFilter === "all") return true;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const topCompetitors = rows.filter((r) => !r.isTarget).slice(0, 5);
  const consistencyScore = targetRow ? Math.min(100, targetRow.sharePct + 10) : null;
  const velocityPct = targetRow ? Math.min(targetRow.sharePct, 99) : null;

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <AiKpiCard label="Top Competitors" value="" hideValue icon={Sparkles}>
          <ol className="mt-1 space-y-1.5">
            {topCompetitors.slice(0, 5).map((c, i) => (
              <li key={c.key} className="flex items-center gap-2 text-[11px] text-text">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-subtle text-[10px] font-bold text-text-muted">
                  {i + 1}
                </span>
                <span className="truncate font-medium">{c.name}</span>
              </li>
            ))}
          </ol>
          <button type="button" className="mt-2 text-[10px] font-medium text-emerald-700 hover:underline">
            View full landscape →
          </button>
        </AiKpiCard>
        <AiKpiCard
          label="Mention Velocity"
          value={velocityPct != null ? `+${velocityPct}%` : "—"}
          sub="vs previous run"
          icon={TrendingUp}
          sparkPoints={trendSpark}
        >
          {velocityPct != null && velocityPct > 15 && (
            <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-medium text-emerald-700">
              <TrendingUp className="h-3 w-3" />
              Accelerating
            </p>
          )}
        </AiKpiCard>
        <AiKpiCard
          label="Consistency Score"
          value={consistencyScore != null ? `${consistencyScore}/100` : "—"}
          icon={Sparkles}
        >
          {consistencyScore != null && (
            <>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                <div className="h-full bg-emerald-500" style={{ width: `${consistencyScore}%` }} />
              </div>
              {consistencyScore != null && consistencyScore >= 70 && (
                <span className="mt-2 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                  High
                </span>
              )}
              <p className="mt-1 text-[10px] text-zinc-500">Your visibility is consistent across engines</p>
            </>
          )}
        </AiKpiCard>
        <AiKpiCard
          label="Engines Mentioning You"
          value={`${enginesMentioning} / ${aggregate?.totalEngines ?? 5}`}
          sub={`You appear in ${Math.round((enginesMentioning / (aggregate?.totalEngines ?? 5)) * 100)}% of tracked engines`}
          icon={Sparkles}
        >
          <div className="mt-2">
            <EngineIconRow engines={targetEngines} />
          </div>
        </AiKpiCard>
        <AiKpiCard label="Visibility Trend (All Mentions)" value="" hideValue sub="Last 30 days" icon={TrendingUp} sparkPoints={trendSpark}>
          <div className="mt-1 h-16 w-full">
            <svg viewBox="0 0 120 40" className="h-full w-full text-emerald-500" aria-hidden>
              <polyline
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                points={trendSpark
                  .map((v, i) => {
                    const x = trendSpark.length > 1 ? (i / (trendSpark.length - 1)) * 120 : 0;
                    const max = Math.max(...trendSpark, 1);
                    const y = 36 - (v / max) * 30;
                    return `${x},${y}`;
                  })
                  .join(" ")}
              />
            </svg>
          </div>
        </AiKpiCard>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
          <input
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Search companies…"
            className="w-full rounded-md border border-border bg-white py-1.5 pl-8 pr-3 text-[13px] shadow-sm"
          />
        </div>
        <select
          value={engineFilter}
          onChange={(e) => setEngineFilter(e.target.value)}
          className="rounded-md border border-border bg-white px-2.5 py-1.5 text-xs font-medium text-text shadow-sm"
        >
          <option value="all">All Engines</option>
          {(["chatgpt", "perplexity", "gemini", "google_ai_overview", "claude"] as AiEngine[]).map((e) => (
            <option key={e} value={e}>
              {ENGINE_LABELS[e]}
            </option>
          ))}
        </select>
        <select className="rounded-md border border-border bg-white px-2.5 py-1.5 text-xs font-medium text-text shadow-sm" defaultValue="all">
          <option value="all">All Status</option>
          <option value="strong">Strong</option>
          <option value="moderate">Moderate</option>
          <option value="weak">Weak</option>
        </select>
        <button
          type="button"
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-2.5 py-1.5 text-xs font-medium text-text shadow-sm hover:bg-surface-subtle"
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </button>
      </div>

      <AiPanel className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-[13px]">
            <thead className="border-b border-border bg-surface-subtle/80">
              <tr>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-text-muted">#</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-text-muted">Company</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-text-muted">Run Share</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-text-muted">Trend (Across Runs)</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-text-muted">Avg. Position</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-text-muted">Engines Mentioned In</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-text-muted">Last Seen</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-text-muted">Status</th>
                <th className="w-10 px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {paged.map((row, i) => {
                const st = statusFromShare(row.sharePct);
                const StatusIcon = st.Icon;
                return (
                  <tr key={row.key} className={row.isTarget ? "bg-emerald-50/30" : "hover:bg-surface-subtle/50"}>
                    <td className="px-3 py-2 text-text-muted">{(page - 1) * pageSize + i + 1}</td>
                    <td className="px-3 py-2 font-medium">
                      {row.name}
                      {row.isTarget && (
                        <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                          You
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-14 overflow-hidden rounded-full bg-surface-subtle">
                          <div className="h-full bg-emerald-500" style={{ width: `${row.sharePct}%` }} />
                        </div>
                        <span className="text-xs tabular-nums text-text-muted">
                          {row.runShare} ({row.sharePct}%)
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <TrendSparkline seed={i} />
                    </td>
                    <td className={cn("px-3 py-2 tabular-nums font-medium", posColor(row.avgPosition))}>
                      {row.avgPosition ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <EngineIconRow engines={row.engines} />
                    </td>
                    <td className="px-3 py-2 text-xs text-text-muted">
                      {row.lastSeen ? new Date(row.lastSeen).toLocaleDateString() : showCombined ? `${recentRunCount} runs` : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", st.className)}>
                        <StatusIcon className="h-3 w-3" />
                        {st.label}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <button type="button" className="rounded p-1 text-text-muted hover:bg-surface-subtle">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3.5 py-2 text-xs text-text-muted">
          <span>
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, filtered.length)} of {filtered.length} companies
          </span>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {Array.from({ length: Math.min(totalPages, 3) }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded border text-xs",
                    p === page ? "border-primary text-emerald-700" : "border-transparent hover:bg-surface-subtle"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
            <select className="rounded border border-border px-2 py-1 text-xs" defaultValue="10">
              <option value="10">10 / page</option>
              <option value="25">25 / page</option>
            </select>
          </div>
        </div>
      </AiPanel>
    </div>
  );
}
