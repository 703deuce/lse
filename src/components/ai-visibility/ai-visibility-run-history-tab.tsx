"use client";

import { useMemo } from "react";
import { Eye, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ENGINE_LABELS, type AiEngine, type RunSummary, type VisibilityTrendPoint } from "@/lib/ai-visibility/types";
import { AiPanel, EngineIconRow, StatusPill } from "@/components/ai-visibility/ai-visibility-ui";
import type { EngineResultRow } from "@/components/ai-visibility/ai-visibility-types";
import { cn } from "@/lib/utils";

export function AiVisibilityRunHistoryTab({
  runs,
  visibilityTrend,
  engineResults,
  onSelectRun,
}: {
  runs: RunSummary[];
  visibilityTrend: VisibilityTrendPoint[];
  engineResults: EngineResultRow[];
  onSelectRun: (runId: string) => void;
}) {
  const completeRuns = runs.filter((r) => r.status === "complete");

  const chartData = [...visibilityTrend]
    .reverse()
    .map((p) => ({
      date: new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      score: p.visibilityScore ?? 0,
    }));

  const insights = useMemo(() => {
    if (!completeRuns.length) return null;
    const sorted = [...completeRuns].sort((a, b) => (b.visibility_score ?? 0) - (a.visibility_score ?? 0));
    const best = sorted[0];
    const recent = completeRuns[0];
    let biggestUp = { delta: 0, from: "", to: "" };
    let biggestDown = { delta: 0, from: "", to: "" };
    for (let i = 0; i < completeRuns.length - 1; i++) {
      const cur = completeRuns[i].visibility_score ?? 0;
      const prev = completeRuns[i + 1].visibility_score ?? 0;
      const delta = cur - prev;
      const label = new Date(completeRuns[i].created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
      if (delta > biggestUp.delta) biggestUp = { delta, from: label, to: "" };
      if (delta < biggestDown.delta) biggestDown = { delta, from: label, to: "" };
    }
    const mentionedRuns = completeRuns.filter((r) => r.target_mentioned).length;
    return { best, recent, biggestUp, biggestDown, mentionedRuns, mentionPct: Math.round((mentionedRuns / completeRuns.length) * 100) };
  }, [completeRuns]);

  if (!completeRuns.length) {
    return <p className="text-sm text-text-muted">No completed runs yet. Run a check to start tracking.</p>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <div className="space-y-4">
        <AiPanel title="Visibility score over time" subtitle="Line chart shows your visibility score across all runs in the selected time range." action={
          <select className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[10px] font-medium text-zinc-600 shadow-sm" defaultValue="all">
            <option value="all">All engines</option>
          </select>
        }>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 9 }} width={28} domain={[0, 100]} />
                <Tooltip />
                <Area type="monotone" dataKey="score" stroke="#16A34A" fill="#16A34A" fillOpacity={0.12} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </AiPanel>

        <AiPanel title={`Run history (${completeRuns.length} runs)`} subtitle="Detailed log of all visibility checks in the selected time range." className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-border bg-surface-subtle/80">
                <tr>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase text-text-muted">Date & Time</th>
                  <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase text-text-muted">Visibility Score</th>
                  <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase text-text-muted">Mentioned You?</th>
                  <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase text-text-muted">Companies Found</th>
                  <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase text-text-muted">Sources Cited</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase text-text-muted">Engines Mentioning You</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase text-text-muted">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {completeRuns.slice(0, 10).map((r, i) => {
                  const prev = completeRuns[i + 1];
                  const delta =
                    prev && r.visibility_score != null && prev.visibility_score != null
                      ? r.visibility_score - prev.visibility_score
                      : null;
                  const trend = visibilityTrend.find((t) => t.runId === r.id);
                  const runEngines = r.id === engineResults[0]?.id
                    ? engineResults.filter((e) => e.target_mentioned).map((e) => e.engine as AiEngine)
                    : [];
                  return (
                    <tr key={r.id} className="hover:bg-surface-subtle/50">
                      <td className="px-3 py-3 font-medium">{new Date(r.created_at).toLocaleString()}</td>
                      <td className="px-3 py-3 text-center">
                        <span className="font-semibold tabular-nums">{r.visibility_score ?? "—"}%</span>
                        {delta != null && delta !== 0 && (
                          <span className={cn("ml-1 text-xs", delta > 0 ? "text-primary" : "text-red-600")}>
                            {delta > 0 ? "↑" : "↓"} {Math.abs(delta)}%
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <StatusPill yes={!!r.target_mentioned} />
                      </td>
                      <td className="px-3 py-3 text-center tabular-nums">{trend?.companyCount ?? r.companyCount}</td>
                      <td className="px-3 py-3 text-center tabular-nums">{r.sources_count}</td>
                      <td className="px-3 py-3">
                        <EngineIconRow engines={runEngines} />
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => onSelectRun(r.id)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View snapshot
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t border-border px-4 py-2 text-xs text-text-muted">
            1–{Math.min(10, completeRuns.length)} of {completeRuns.length}
          </p>
        </AiPanel>
      </div>

      {insights && (
        <AiPanel title="Run insights">
          <div className="space-y-3">
            <InsightRow
              icon={Trophy}
              iconClass="text-primary"
              title="Best run"
              value={`${insights.best.visibility_score ?? 0}% visibility`}
              sub={new Date(insights.best.created_at).toLocaleString()}
            />
            <InsightRow
              icon={Eye}
              iconClass="text-sky-600"
              title="Most recent run"
              value={`${insights.recent.visibility_score ?? 0}% visibility`}
              sub={new Date(insights.recent.created_at).toLocaleString()}
            />
            {insights.biggestUp.delta > 0 && (
              <InsightRow
                icon={TrendingUp}
                iconClass="text-primary"
                title="Biggest increase"
                value={`+${insights.biggestUp.delta}%`}
                sub={insights.biggestUp.from}
              />
            )}
            {insights.biggestDown.delta < 0 && (
              <InsightRow
                icon={TrendingDown}
                iconClass="text-red-600"
                title="Biggest decrease"
                value={`${insights.biggestDown.delta}%`}
                sub={insights.biggestDown.from}
              />
            )}
            <InsightRow
              icon={Trophy}
              iconClass="text-violet-600"
              title="Consistency"
              value={`${insights.mentionPct}% runs mentioned you`}
              sub={`${insights.mentionedRuns}/${completeRuns.length} runs`}
            />
          </div>
          <button type="button" className="mt-4 text-xs font-medium text-emerald-700 hover:underline">
            View all insights →
          </button>
        </AiPanel>
      )}
    </div>
  );
}

function InsightRow({
  icon: Icon,
  iconClass,
  title,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
  title: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="flex gap-3">
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", iconClass)} />
      <div>
        <p className="text-xs font-medium text-text-muted">{title}</p>
        <p className="text-sm font-semibold text-text">{value}</p>
        <p className="text-[10px] text-text-muted">{sub}</p>
      </div>
    </div>
  );
}
