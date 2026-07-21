"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChevronDown, Info, Sparkles } from "lucide-react";
import {
  ENGINE_LABELS,
  type AggregateMetrics,
  type AiEngine,
  type HistoricalMentionRow,
  type MentionLeaderboardRow,
  type VisibilityTrendPoint,
} from "@/lib/ai-visibility/types";
import { AiPanel, EngineCoverageRow, EngineIconRow, EngineLogo } from "@/components/ai-visibility/ai-visibility-ui";
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
          <div className="flex items-center gap-2 text-[#137752]">
            <Sparkles className="h-4 w-4" />
            <h3 className="text-[13px] font-semibold">AI Summary</h3>
          </div>
          <p className="mt-1.5 text-[13px] leading-snug text-[#475467]">
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
                  <Area type="monotone" dataKey="score" stroke="#137752" fill="#137752" fillOpacity={0.15} strokeWidth={2} dot={{ r: 2.5, fill: "#137752" }} />
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

      <div className="grid items-start gap-2 lg:grid-cols-10">
        <AiPanel
          title={isCombined ? "Who AI Recommends" : "Who AI Recommends (this run)"}
          className="lg:col-span-6"
          action={<Info className="h-3.5 w-3.5 text-[#D0D5DD]" />}
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
                      <tr key={row.normalizedName} className={row.isTargetBrand ? "bg-[#ECFDF3]/40" : ""}>
                        <td className="px-3.5 py-2 text-text-muted">{i + 1}</td>
                        <td className="px-3.5 py-2 font-medium">
                          {row.displayName}
                          {row.isTargetBrand && (
                            <span className="ml-2 rounded bg-[#ECFDF3] px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">You</span>
                          )}
                        </td>
                        <td className="px-3.5 py-2">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-14 overflow-hidden rounded-full bg-surface-subtle">
                              <div className="h-full bg-[#ECFDF3]0" style={{ width: `${sharePct}%` }} />
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
            action={<Info className="h-3.5 w-3.5 text-[#D0D5DD]" />}
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
                  <div className="h-full bg-[#ECFDF3]0" style={{ width: `${barPct}%` }} />
                </div>
              </div>
            ))}
          </AiPanel>

          <AiPanel
            title="Run Health"
            subtitle="What happened during this run"
            action={<Info className="h-3.5 w-3.5 text-[#D0D5DD]" />}
            bodyClassName="space-y-2 pt-2"
          >
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-[#ECFDF3] px-2 py-2">
                <p className="text-base font-bold tabular-nums text-emerald-800">
                  {engineResults.filter((e) => e.status === "complete").length}
                </p>
                <p className="text-[10px] font-medium text-[#137752]">Complete</p>
              </div>
              <div className="rounded-lg bg-amber-50 px-2 py-2">
                <p className="text-base font-bold tabular-nums text-amber-800">{failedEngines.length}</p>
                <p className="text-[10px] font-medium text-amber-700">Needs rerun</p>
              </div>
              <div className="rounded-lg bg-sky-50 px-2 py-2">
                <p className="text-base font-bold tabular-nums text-sky-800">
                  {new Set(engineResults.flatMap((e) => e.sources_json.map((s) => s.url).filter(Boolean))).size}
                </p>
                <p className="text-[10px] font-medium text-sky-700">Domains cited</p>
              </div>
            </div>
            {failedEngines.length > 0 ? (
              <ul className="space-y-1 text-[11px] text-text-muted">
                {failedEngines.slice(0, 3).map((e) => (
                  <li key={`fail-${e.id}`}>
                    <span className="font-semibold text-amber-700">{ENGINE_LABELS[e.engine as AiEngine]}:</span>{" "}
                    {e.error_message ?? "Provider did not return a complete answer."}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-text-muted">All configured engines returned complete results.</p>
            )}
          </AiPanel>
        </div>
      </div>

      {!isCombined && engineResults.length > 0 && (
        <AiPanel
          title="Prompts & Full Model Responses"
          subtitle="Open each engine to review the exact prompt, full answer text, citations, and extracted companies."
          bodyClassName="space-y-2 pt-2"
        >
          {engineResults.map((result, index) => (
            <ModelResponseDisclosure key={result.id} result={result} defaultOpen={index === 0} />
          ))}
        </AiPanel>
      )}
    </div>
  );
}

function ModelResponseDisclosure({
  result,
  defaultOpen,
}: {
  result: EngineResultRow;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const engine = result.engine as AiEngine;
  const mentions = result.mentions_json.map((m) => m.name).filter(Boolean);
  return (
    <div className="rounded-lg border border-[#E6EAF0] bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900 text-white">
          <EngineLogo engine={engine} className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold text-[#101828]">{ENGINE_LABELS[engine]}</span>
          <span className="block truncate text-[11px] text-[#667085]">
            {result.prompt_text ?? "Prompt unavailable"}
          </span>
        </span>
        <span className="rounded-full bg-[#F2F4F7] px-2 py-0.5 text-[10px] font-semibold capitalize text-[#475467]">
          {result.status.replace(/_/g, " ")}
        </span>
        <ChevronDown className={`h-4 w-4 text-[#98A2B3] transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-3 border-t border-[#EEF1F5] px-3 py-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#98A2B3]">Prompt</p>
            <p className="mt-1 rounded-lg bg-[#F9FAFB] px-3 py-2 text-[12px] leading-relaxed text-[#344054]">
              {result.prompt_text ?? "Prompt unavailable"}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#98A2B3]">Full response</p>
            <p className="mt-1 max-h-80 overflow-y-auto whitespace-pre-wrap rounded-lg border border-[#EEF1F5] bg-[#F9FAFB] px-3 py-2 text-[12px] leading-relaxed text-[#344054]">
              {result.answer_text?.trim() || result.error_message || "No answer text returned."}
            </p>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#98A2B3]">Extracted companies</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {mentions.length ? (
                  mentions.slice(0, 12).map((name) => (
                    <span key={name} className="rounded-full bg-[#ECFDF3] px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                      {name}
                    </span>
                  ))
                ) : (
                  <span className="text-[11px] text-[#667085]">No companies extracted.</span>
                )}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#98A2B3]">Citations</p>
              <ul className="mt-1 space-y-1 text-[11px] text-[#475467]">
                {result.sources_json.length ? (
                  result.sources_json.slice(0, 5).map((source, i) => (
                    <li key={`${source.url ?? source.label}-${i}`} className="truncate">
                      {source.position ? `${source.position}. ` : ""}
                      {source.label ?? source.url ?? "Source"}
                    </li>
                  ))
                ) : (
                  <li className="text-[#667085]">No citations returned.</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
