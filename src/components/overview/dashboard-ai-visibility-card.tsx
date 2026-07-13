import Link from "next/link";
import type { AiEngine } from "@/lib/ai-visibility/types";
import type { DashboardAiVisibility } from "@/lib/overview/dashboard-featured-types";
import { cn } from "@/lib/utils";

const ENGINE_STYLE: Record<AiEngine, { short: string; className: string }> = {
  chatgpt: { short: "GPT", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  gemini: { short: "Gem", className: "bg-blue-50 text-blue-700 ring-blue-200" },
  claude: { short: "Cla", className: "bg-orange-50 text-orange-700 ring-orange-200" },
  perplexity: { short: "Px", className: "bg-cyan-50 text-cyan-700 ring-cyan-200" },
  google_ai_overview: { short: "G", className: "bg-violet-50 text-violet-700 ring-violet-200" },
};

function EnginePill({
  label,
  mentioned,
  engine,
}: {
  label: string;
  mentioned: boolean;
  engine: AiEngine;
}) {
  const style = ENGINE_STYLE[engine];
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-md border border-zinc-100 px-2 py-1.5",
        mentioned ? "bg-emerald-50/50" : "bg-white"
      )}
    >
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded text-[9px] font-bold ring-1",
          style.className
        )}
      >
        {style.short}
      </span>
      <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-zinc-700">{label}</span>
      <span className={cn("text-[10px] font-bold", mentioned ? "text-emerald-600" : "text-zinc-300")}>
        {mentioned ? "✓" : "✕"}
      </span>
    </div>
  );
}

function formatRunDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function DashboardAiVisibilityCard({
  businessId,
  data,
}: {
  businessId: string;
  data: DashboardAiVisibility;
}) {
  const runLabel = formatRunDate(data.lastRunAt);

  return (
    <article className="flex h-full flex-col rounded-xl border border-zinc-200/80 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">AI Visibility</h2>
          {runLabel && (
            <p className="mt-0.5 text-[11px] text-zinc-500">Last check {runLabel}</p>
          )}
        </div>
        <Link
          href={`/businesses/${businessId}/ai-visibility`}
          className="shrink-0 text-xs font-medium text-emerald-600 hover:text-emerald-700"
        >
          Open results →
        </Link>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
        {data.visibilityScore != null && (
          <p className="text-zinc-600">
            Score{" "}
            <span className="text-base font-bold tabular-nums text-zinc-900">
              {Math.round(data.visibilityScore)}
            </span>
            <span className="text-zinc-400">/100</span>
          </p>
        )}
        <p
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-semibold",
            data.targetMentioned
              ? "bg-emerald-50 text-emerald-700"
              : "bg-zinc-100 text-zinc-600"
          )}
        >
          {data.targetMentioned ? "You were mentioned" : "Not mentioned yet"}
        </p>
        <p className="text-zinc-500">
          <span className="font-semibold text-zinc-800">{data.companyCount}</span> companies tracked
        </p>
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-1.5">
        {data.engines.map((e) => (
          <EnginePill
            key={e.engine}
            engine={e.engine}
            label={e.label}
            mentioned={e.mentioned}
          />
        ))}
      </div>

      {data.primaryPrompt && (
        <p className="mt-2 line-clamp-1 rounded-md bg-zinc-50 px-2 py-1 text-[11px] text-zinc-600">
          <span className="font-medium text-zinc-500">Prompt:</span> {data.primaryPrompt}
        </p>
      )}

      {data.mentions.length > 0 && (
        <div className="mt-2.5 border-t border-zinc-100 pt-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">
            Top mentions
          </p>
          <ul className="mt-1 space-y-1.5">
            {data.mentions.map((m) => (
              <li key={m.name} className="space-y-0.5">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span
                    className={cn(
                      "min-w-0 truncate",
                      m.isTarget ? "font-semibold text-emerald-700" : "text-zinc-700"
                    )}
                  >
                    {m.isTarget ? "★ " : "• "}
                    {m.name}
                  </span>
                  <span className="shrink-0 tabular-nums text-zinc-400">
                    {m.sharePct}% · {m.engineCount} engines
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      m.isTarget ? "bg-emerald-500" : "bg-zinc-300"
                    )}
                    style={{ width: `${Math.max(6, Math.min(100, m.sharePct))}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!data.hasData && (
        <p className="mt-2 text-xs text-zinc-500">Run an AI visibility check to see model coverage.</p>
      )}
    </article>
  );
}
