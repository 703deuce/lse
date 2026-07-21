"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ExternalLink, MessageSquareText } from "lucide-react";
import { ENGINE_LABELS, type AiEngine } from "@/lib/ai-visibility/types";
import { AiMarkdownResponse } from "@/components/ai-visibility/ai-markdown-response";
import { EngineLogo } from "@/components/ai-visibility/ai-visibility-ui";
import type { EngineResultRow } from "@/components/ai-visibility/ai-visibility-types";
import { ModuleEmptyState } from "@/components/journey/module-empty-state";
import { cardClass } from "@/components/ui/design-system";
import { cn } from "@/lib/utils";

const ENGINE_ORDER: AiEngine[] = [
  "chatgpt",
  "claude",
  "gemini",
  "perplexity",
  "google_ai_overview",
];

export function AiVisibilityResponsesTab({
  engineResults,
  isCombined,
  onOpenRun,
}: {
  engineResults: EngineResultRow[];
  isCombined: boolean;
  onOpenRun?: () => void;
}) {
  const sorted = useMemo(() => {
    const rank = new Map(ENGINE_ORDER.map((e, i) => [e, i]));
    return [...engineResults].sort(
      (a, b) => (rank.get(a.engine as AiEngine) ?? 99) - (rank.get(b.engine as AiEngine) ?? 99)
    );
  }, [engineResults]);

  const [selectedId, setSelectedId] = useState<string | null>(sorted[0]?.id ?? null);
  const selected = sorted.find((r) => r.id === selectedId) ?? sorted[0] ?? null;

  if (isCombined) {
    return (
      <ModuleEmptyState
        icon={<MessageSquareText className="h-5 w-5" />}
        title="Pick a single run to read answers"
        description="Full prompts and model responses are available per run. Switch from All Runs to a specific check above, then open this tab."
        actionLabel="View latest run"
        onAction={onOpenRun}
      />
    );
  }

  if (!sorted.length) {
    return (
      <ModuleEmptyState
        icon={<MessageSquareText className="h-5 w-5" />}
        title="No model responses yet"
        description="Run an AI Visibility check to capture prompts and full answers from each engine."
        actionLabel="Go to Dashboard"
        onAction={onOpenRun}
      />
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className={cn(cardClass, "overflow-hidden p-0")}>
        <div className="border-b border-zinc-100 px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            Models
          </p>
        </div>
        <ul className="divide-y divide-zinc-100">
          {sorted.map((result) => {
            const engine = result.engine as AiEngine;
            const active = selected?.id === result.id;
            return (
              <li key={result.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(result.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition",
                    active ? "bg-emerald-50/80" : "hover:bg-zinc-50"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset",
                      active
                        ? "bg-white text-emerald-700 ring-emerald-200"
                        : "bg-zinc-50 text-zinc-600 ring-zinc-200"
                    )}
                  >
                    <EngineLogo engine={engine} className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-zinc-900">
                      {ENGINE_LABELS[engine] ?? engine}
                    </span>
                    <span className="block truncate text-[11px] capitalize text-zinc-500">
                      {result.status.replace(/_/g, " ")}
                      {result.target_mentioned ? " · mentioned you" : ""}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {selected ? <ResponseDetail result={selected} /> : null}
    </div>
  );
}

function ResponseDetail({ result }: { result: EngineResultRow }) {
  const engine = result.engine as AiEngine;
  const mentions = result.mentions_json.map((m) => m.name).filter(Boolean);
  const [promptOpen, setPromptOpen] = useState(true);

  return (
    <div className="space-y-3">
      <div className={cn(cardClass, "flex flex-wrap items-center gap-3 p-3.5")}>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-white">
          <EngineLogo engine={engine} className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-zinc-900">
            {ENGINE_LABELS[engine] ?? engine}
          </p>
          <p className="text-[12px] text-zinc-500">
            {result.target_mentioned
              ? `Mentioned you${result.mention_position != null ? ` at position ${result.mention_position}` : ""}`
              : "Did not mention your business"}
          </p>
        </div>
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold capitalize text-zinc-600">
          {result.status.replace(/_/g, " ")}
        </span>
      </div>

      <div className={cn(cardClass, "overflow-hidden p-0")}>
        <button
          type="button"
          onClick={() => setPromptOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 border-b border-zinc-100 px-4 py-2.5 text-left"
        >
          <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            Prompt used
          </span>
          <ChevronDown
            className={cn("h-4 w-4 text-zinc-400 transition", promptOpen && "rotate-180")}
          />
        </button>
        {promptOpen ? (
          <p className="px-4 py-3 text-[13px] leading-relaxed text-zinc-700">
            {result.prompt_text?.trim() || "Prompt unavailable for this result."}
          </p>
        ) : null}
      </div>

      <div className={cn(cardClass, "space-y-2 p-3.5")}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            Full response
          </p>
          <span className="text-[11px] text-zinc-400">Rendered as markdown</span>
        </div>
        {result.error_message && !result.answer_text ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
            {result.error_message}
          </p>
        ) : (
          <AiMarkdownResponse content={result.answer_text ?? ""} />
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className={cn(cardClass, "p-3.5")}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            Companies extracted
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {mentions.length ? (
              mentions.slice(0, 20).map((name) => (
                <span
                  key={name}
                  className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-800 ring-1 ring-inset ring-emerald-100"
                >
                  {name}
                </span>
              ))
            ) : (
              <p className="text-[12px] text-zinc-500">No companies extracted.</p>
            )}
          </div>
        </div>
        <div className={cn(cardClass, "p-3.5")}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            Citations
          </p>
          <ul className="mt-2 space-y-1.5">
            {result.sources_json.length ? (
              result.sources_json.slice(0, 8).map((source, i) => {
                const label = source.label ?? source.url ?? "Source";
                return (
                  <li key={`${source.url ?? label}-${i}`} className="flex items-start gap-2 text-[12px]">
                    <span className="mt-0.5 tabular-nums text-zinc-400">
                      {source.position ?? i + 1}.
                    </span>
                    {source.url ? (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-w-0 items-center gap-1 font-medium text-emerald-700 hover:underline"
                      >
                        <span className="truncate">{label}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    ) : (
                      <span className="text-zinc-700">{label}</span>
                    )}
                  </li>
                );
              })
            ) : (
              <li className="text-[12px] text-zinc-500">No citations returned.</li>
            )}
          </ul>
          {result.sources_json.length > 8 ? (
            <p className="mt-2 text-[11px] text-zinc-400">
              +{result.sources_json.length - 8} more in Evidence
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
