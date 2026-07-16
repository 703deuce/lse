"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowRight, Info, Sparkles, Star, Zap } from "lucide-react";
import {
  ENGINE_LABELS,
  type AggregateMetrics,
  type AiEngine,
  type HistoricalMentionRow,
  type MentionLeaderboardRow,
  type VisibilityTrendPoint,
} from "@/lib/ai-visibility/types";
import { AiPanel, EngineCoverageRow, EngineIconRow } from "@/components/ai-visibility/ai-visibility-ui";
import type { EngineResultRow } from "@/components/ai-visibility/ai-visibility-types";

const ALL_ENGINES: AiEngine[] = ["chatgpt", "perplexity", "gemini", "google_ai_overview", "claude"];

type RunRow = {
  id: string;
  visibility_score: number | null;
  ai_summary: string | null;
};

export function AiVisibilityDashboardTab({
  isCombined,
  run,
  aggregate,
  leaderboard,
  historicalMentions,
  visibilityTrend,
  engineResults,
  aiSummary,
  totalEngines,
  completeRuns,
}: {
  isCombined: boolean;
  run: RunRow | null;
  aggregate: AggregateMetrics | undefined;
  leaderboard: MentionLeaderboardRow[];
  historicalMentions: HistoricalMentionRow[];
  visibilityTrend: VisibilityTrendPoint[];
  engineResults: EngineResultRow[];
  aiSummary: string | null | undefined;
  totalEngines: number;
  completeRuns: number;
}) {
  const chartData = [...visibilityTrend]
    .reverse()
    .map((p) => ({
      date: new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      score: p.visibilityScore ?? 0,
    }));

  const recommendRows = isCombined ? historicalMentions.slice(0, 5) : leaderboard.slice(0, 5);
  const te = totalEngines || 5;

  const coverageEngines = ALL_ENGINES.map((engine) => {
    const er = engineResults.find((r) => r.engine === engine);
    const mentioned = er?.target_mentioned ? 1 : 0;
    return {
      engine,
      mentioned,
      total: 1,
      status: er?.status ?? null,
      errorMessage: er?.error_message ?? null,
    };
  });
  const failedEngines = engineResults.filter(
    (e) => e.status !== "complete" && e.status !== "running"
  );

  const matrixCounts = ALL_ENGINES.map((engine) => {
    const er = engineResults.find((r) => r.engine === engine);
    const count = er?.target_mentioned ? 1 : 0;
    const denom = isCombined ? completeRuns || 1 : 1;
    const pct = Math.round((count / denom) * 100) || 0;
    return { engine, count: isCombined ? count : count, displayCount: isCombined ? `${count}` : `${count}`, pct, barPct: isCombined ? pct : count * 100 };
  });

  if (!isCombined && !run) {
    return <p className="text-[13px] text-text-muted">Run a check to see who AI recommends for your prompt.</p>;
  }
  if (isCombined && !aggregate?.completeRuns) {
    return <p className="text-[13px] text-text-muted">Run a check to start building your AI visibility history.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="grid items-start gap-2 lg:grid-cols-10">
        <AiPanel className="lg:col-span-4" bodyClassName="pt-2.5">
          <div className="flex items-center gap-2 text-emerald-700">
            <Sparkles className="h-4 w-4" />
            <h3 className="text-[13px] font-semibold">AI Summary</h3>
          </div>
          <p className="mt-1.5 text-[13px] leading-snug text-zinc-600">
            {aiSummary ??
              (isCombined
                ? `Tracking ${aggregate?.completeRuns ?? 0} runs across ${aggregate?.totalEngineChecks ?? 0} engine checks.`
                : "No summary for this run yet.")}
          </p>
        </AiPanel>

        <AiPanel
          title="Visibility Trend"
          subtitle="From your completed runs"
          className="lg:col-span-3"
          bodyClassName="pt-1.5"
        >
          <div className="h-32">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9 }} width={28} domain={[0, 100]} />
                  <Tooltip />
                  <Area type="monotone" dataKey="score" stroke="#16A34A" fill="#16A34A" fillOpacity={0.15} strokeWidth={2} dot={{ r: 2.5, fill: "#16A34A" }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-text-muted">Run more checks to see trend.</p>
            )}
          </div>
        </AiPanel>

        <AiPanel
          title="Engine Coverage"
          subtitle="Where you appear across AI platforms"
          className="lg:col-span-3"
          bodyClassName="space-y-2 pt-2"
        >
          {engineResults.length ? (
            coverageEngines.map(({ engine, mentioned, total, status, errorMessage }) => (
              <EngineCoverageRow
                key={engine}
                engine={engine}
                mentioned={mentioned}
                total={total}
                status={status}
                errorMessage={errorMessage}
              />
            ))
          ) : (
            <p className="text-xs text-text-muted">Select a specific run to see per-engine coverage.</p>
          )}
        </AiPanel>
      </div>

      {/* Recommends is taller; stack Matrix + Gaps beside it so they stay content-height */}
      <div className="grid items-start gap-2 lg:grid-cols-10">
        <AiPanel
          title={isCombined ? "Who AI Recommends" : "Who AI Recommends (this run)"}
          className="lg:col-span-6"
          action={<Info className="h-3.5 w-3.5 text-zinc-300" />}
          bodyClassName="pt-1.5"
        >
          {recommendRows.length === 0 ? (
            <p className="text-[13px] text-text-muted">No mention data yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                    <th className="px-3.5 pb-2">#</th>
                    <th className="px-3.5 pb-2">Company</th>
                    <th className="px-3.5 pb-2">Engine Share</th>
                    <th className="px-3.5 pb-2">Engines</th>
                    <th className="px-3.5 pb-2">Avg Position</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {recommendRows.map((row, i) => {
                    const sharePct = "sharePct" in row ? row.sharePct : (row as MentionLeaderboardRow).sharePct;
                    const engineCount = "engineCount" in row ? (row as MentionLeaderboardRow).engineCount : row.runCount;
                    const engines = "engines" in row ? (row as MentionLeaderboardRow).engines : [];
                    const avgPos = "avgPosition" in row ? (row as MentionLeaderboardRow).avgPosition : null;
                    return (
                      <tr key={row.normalizedName} className={row.isTargetBrand ? "bg-emerald-50/40" : ""}>
                        <td className="px-3.5 py-2 text-text-muted">{i + 1}</td>
                        <td className="px-3.5 py-2 font-medium">
                          {row.displayName}
                          {row.isTargetBrand && (
                            <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">You</span>
                          )}
                        </td>
                        <td className="px-3.5 py-2">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-14 overflow-hidden rounded-full bg-surface-subtle">
                              <div className="h-full bg-emerald-500" style={{ width: `${sharePct}%` }} />
                            </div>
                            <span className="text-[11px] tabular-nums text-text-muted">
                              {engineCount}/{te} ({sharePct}%)
                            </span>
                          </div>
                        </td>
                        <td className="px-3.5 py-2">
                          <EngineIconRow engines={engines} />
                        </td>
                        <td className="px-3.5 py-2 tabular-nums text-text">{avgPos ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </AiPanel>

        <div className="flex flex-col gap-2 lg:col-span-4">
          <AiPanel
            title="Engine Mention Matrix"
            subtitle="Runs mentioning you per engine"
            action={<Info className="h-3.5 w-3.5 text-zinc-300" />}
            bodyClassName="space-y-2 pt-2"
          >
            {matrixCounts.map(({ engine, count, pct, barPct }) => (
              <div key={engine}>
                <div className="mb-0.5 flex items-center justify-between text-xs">
                  <span className="font-medium text-text">{ENGINE_LABELS[engine]}</span>
                  <span className="tabular-nums text-text-muted">
                    {count} ({isCombined ? `${pct}%` : count ? "100%" : "0%"})
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-subtle">
                  <div className="h-full bg-emerald-500" style={{ width: `${barPct}%` }} />
                </div>
              </div>
            ))}
          </AiPanel>

          <AiPanel title="Opportunities & Gaps" action={<Info className="h-3.5 w-3.5 text-zinc-300" />} bodyClassName="space-y-2.5 pt-2">
            {failedEngines.slice(0, 2).map((e) => (
              <div key={`fail-${e.id}`} className="flex gap-2">
                <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div>
                  <p className="text-xs font-semibold text-text">
                    {ENGINE_LABELS[e.engine as AiEngine]} check failed
                  </p>
                  <p className="mt-0.5 text-[11px] text-text-muted">
                    {e.error_message ?? "Provider error — re-run after verifying API keys/credits."}
                  </p>
                </div>
              </div>
            ))}
            {engineResults
              .filter((e) => e.status !== "failed" && !e.target_mentioned)
              .slice(0, 1)
              .map((e) => (
                <div key={e.id} className="flex gap-2">
                  <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <p className="text-xs font-semibold text-text">Increase presence in {ENGINE_LABELS[e.engine as AiEngine]}</p>
                    <p className="mt-0.5 text-[11px] text-text-muted">You were not mentioned in this engine&apos;s response.</p>
                  </div>
                </div>
              ))}
            <div className="flex gap-2">
              <Star className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <div>
                <p className="text-xs font-semibold text-text">Improve position on Gemini</p>
                <p className="mt-0.5 text-[11px] text-text-muted">Focus on reviews and local citations.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Zap className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
              <div>
                <p className="text-xs font-semibold text-text">Expand source diversity</p>
                <p className="mt-0.5 text-[11px] text-text-muted">More unique domains citing your business helps AI trust.</p>
              </div>
            </div>
          </AiPanel>
        </div>
      </div>
    </div>
  );
}
