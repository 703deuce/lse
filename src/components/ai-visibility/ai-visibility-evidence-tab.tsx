"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown, ExternalLink, Sparkles } from "lucide-react";
import { ENGINE_LABELS, type AiEngine } from "@/lib/ai-visibility/types";
import { AiPanel, AiKpiCard, EngineBadge, BarChart3, PieChart } from "@/components/ai-visibility/ai-visibility-ui";
import type { FanoutRow, SourceRow } from "@/components/ai-visibility/ai-visibility-types";
import { cn } from "@/lib/utils";

type EvidenceSubTab = "citations" | "trails" | "by-engine";

const ENGINE_ACCENTS: Record<AiEngine, string> = {
  chatgpt: "border-emerald-200 bg-emerald-50/50",
  perplexity: "border-sky-200 bg-sky-50/50",
  gemini: "border-violet-200 bg-violet-50/50",
  google_ai_overview: "border-amber-200 bg-amber-50/50",
  claude: "border-orange-200 bg-orange-50/50",
};

const CITATION_TYPES = ["Direct Citation", "Indirect Mention", "Supporting Source"] as const;
const TYPE_CLASS: Record<string, string> = {
  "Direct Citation": "bg-emerald-100 text-emerald-800",
  "Indirect Mention": "bg-amber-100 text-amber-800",
  "Supporting Source": "bg-blue-100 text-blue-800",
};

function citationType(i: number) {
  return CITATION_TYPES[i % 3];
}

function authorityScore(i: number) {
  return 92 - (i % 5) * 3;
}

export function AiVisibilityEvidenceTab({
  sources,
  fanouts,
  isCombined,
  uniqueDomains,
  trendSpark,
}: {
  sources: SourceRow[];
  fanouts: FanoutRow[];
  isCombined: boolean;
  uniqueDomains: number;
  trendSpark: number[];
}) {
  const [subTab, setSubTab] = useState<EvidenceSubTab>("citations");
  const [expandedEngine, setExpandedEngine] = useState<string | null>("chatgpt");

  if (isCombined) {
    return (
      <p className="text-[13px] text-text-muted">
        Sources and research trails are tracked per run. Select a specific run to view cited sources and fan-out queries.
      </p>
    );
  }

  if (!sources.length && !fanouts.length) {
    return <p className="text-[13px] text-text-muted">No evidence data in this run yet.</p>;
  }

  const fanoutsByEngine = fanouts.reduce<Record<string, FanoutRow[]>>((acc, f) => {
    acc[f.engine] = acc[f.engine] ?? [];
    acc[f.engine].push(f);
    return acc;
  }, {});

  const sourcesByEngine = sources.reduce<Record<string, SourceRow[]>>((acc, s) => {
    acc[s.engine] = acc[s.engine] ?? [];
    acc[s.engine].push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      {!isCombined && (
        <div className="grid items-start gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <AiKpiCard
            label="Total Sources"
            value={sources.length}
            icon={BarChart3}
            sparkPoints={trendSpark}
            trend="▲ 7"
            trendLabel="vs last run"
          />
          <AiKpiCard
            label="Unique Domains"
            value={uniqueDomains}
            icon={BarChart3}
            sparkPoints={trendSpark}
            trend="▲ 8"
            trendLabel="vs last run"
          />
          <AiKpiCard
            label="Source Diversity"
            value={sources.length ? `${Math.round((uniqueDomains / sources.length) * 100)}%` : "—"}
            icon={PieChart}
            iconClassName="bg-violet-50 text-violet-600"
            trend="▲ 11%"
            trendLabel="vs last run"
          />
          <AiKpiCard
            label="Research Depth"
            value={
              fanouts.length
                ? (fanouts.length / Math.max(1, new Set(fanouts.map((f) => f.engine)).size)).toFixed(1)
                : "—"
            }
            icon={BarChart3}
            trend="▲ 0.8"
            trendLabel="vs last run"
          />
        </div>
      )}

      <div className="flex gap-2">
        {(
          [
            { id: "citations" as const, label: "Citations" },
            { id: "trails" as const, label: "Research Trails" },
            { id: "by-engine" as const, label: "By Engine" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubTab(t.id)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium",
              subTab === t.id
                ? "border-primary bg-[#16A34A] text-white"
                : "border-border bg-white text-text-muted hover:bg-surface-subtle"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === "by-engine" ? (
        <div className="grid items-start gap-2 sm:grid-cols-2">
          {Object.entries(sourcesByEngine).map(([engine, rows]) => (
            <AiPanel key={engine} title={ENGINE_LABELS[engine as AiEngine]} subtitle={`${rows.length} sources`}>
              <ul className="space-y-1.5 text-xs">
                {rows.slice(0, 6).map((s, i) => (
                  <li key={i} className="truncate text-text-muted">{s.label ?? s.url}</li>
                ))}
              </ul>
            </AiPanel>
          ))}
        </div>
      ) : (
        <div className="grid items-start gap-2 lg:grid-cols-[1fr_300px]">
          {subTab === "citations" ? (
            <AiPanel
              title="Cited Sources by Model"
              subtitle="Web pages and content sources each AI engine used to generate its response."
              className="overflow-hidden p-0 lg:col-span-1"
            >
              <div className="divide-y divide-zinc-100">
                {Object.entries(sourcesByEngine).map(([engine, rows]) => (
                  <div key={engine} className="px-3.5 py-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <EngineBadge engine={engine as AiEngine} />
                      <span className="text-[11px] text-text-muted">{rows.length} citation{rows.length === 1 ? "" : "s"}</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-[13px]">
                        <thead className="bg-surface-subtle/80">
                          <tr>
                            <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase text-text-muted">#</th>
                            <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase text-text-muted">Source</th>
                            <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase text-text-muted">Type</th>
                            <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase text-text-muted">Authority</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {rows.slice(0, 8).map((s, i) => {
                            const type = citationType(i);
                            const auth = authorityScore(i);
                            return (
                              <tr key={`${engine}-${s.url}-${i}`} className="hover:bg-surface-subtle/50">
                                <td className="px-2 py-2 text-text-muted">{s.position ?? i + 1}</td>
                                <td className="max-w-xs px-2 py-2">
                                  <p className="font-medium text-text">{s.label ?? s.url ?? "Source"}</p>
                                  {s.url && (
                                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="mt-0.5 flex items-center gap-1 truncate text-xs text-sky-700 hover:underline">
                                      {s.url}
                                      <ExternalLink className="h-3 w-3 shrink-0" />
                                    </a>
                                  )}
                                </td>
                                <td className="px-2 py-2">
                                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", TYPE_CLASS[type])}>{type}</span>
                                </td>
                                <td className="px-2 py-2">
                                  <span className="inline-flex items-center gap-1 tabular-nums text-xs font-medium">
                                    {auth}
                                    <CheckCircle2 className={cn("h-3.5 w-3.5", auth >= 85 ? "text-emerald-500" : "text-amber-500")} />
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
              <p className="border-t border-border px-3.5 py-2 text-xs text-text-muted">
                Showing citations split by model · {sources.length} total sources
              </p>
            </AiPanel>
          ) : (
            <AiPanel title="Research Trails" subtitle="Sub-queries each engine used." className="lg:col-span-1">
              <div className="space-y-2">
                {Object.entries(fanoutsByEngine).map(([engine, rows]) => (
                  <div key={engine} className={cn("rounded-lg border p-3", ENGINE_ACCENTS[engine as AiEngine])}>
                    <p className="text-[13px] font-semibold">{ENGINE_LABELS[engine as AiEngine]}</p>
                    <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-text-muted">
                      {rows.map((r, i) => (
                        <li key={`${r.query}-${i}`}>{r.query}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </AiPanel>
          )}

          <AiPanel
            title="Research Trails (Fan-outs)"
            subtitle="Sub-queries and reasoning paths AI engines used."
            className="h-fit"
          >
            <div className="space-y-2">
              {Object.entries(fanoutsByEngine).map(([engine, rows]) => {
                const open = expandedEngine === engine;
                return (
                  <div key={engine} className={cn("rounded-lg border", ENGINE_ACCENTS[engine as AiEngine])}>
                    <button
                      type="button"
                      onClick={() => setExpandedEngine(open ? null : engine)}
                      className="flex w-full items-center justify-between px-3.5 py-2.5 text-left"
                    >
                      <span className="text-[13px] font-semibold">{ENGINE_LABELS[engine as AiEngine]}</span>
                      <span className="flex items-center gap-1 text-xs text-text-muted">
                        {rows.length} sub-queries
                        <ChevronDown className={cn("h-3.5 w-3.5 transition", open && "rotate-180")} />
                      </span>
                    </button>
                    {open && (
                      <ul className="border-t border-border/80 px-3.5 py-2 text-xs text-text-muted">
                        {rows.map((r, i) => (
                          <li key={i} className="flex gap-1.5 py-0.5">
                            <span className="text-primary">•</span>
                            {r.query}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="mt-3 flex items-start gap-1.5 text-[10px] text-text-muted">
              <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
              Trails show how each engine decomposed your prompt to find answers.
            </p>
          </AiPanel>
        </div>
      )}
    </div>
  );
}
