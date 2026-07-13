import Link from "next/link";
import type { AiEngine } from "@/lib/ai-visibility/types";
import type { DashboardAiVisibility } from "@/lib/overview/dashboard-featured-types";
import {
  dashboardAccentLink,
  dashboardBadge,
  dashboardBody,
  dashboardCardClass,
  dashboardCardMeta,
  dashboardCardTitle,
  dashboardMicro,
  dashboardSectionLabel,
} from "@/components/overview/dashboard-ui";
import { cn } from "@/lib/utils";

const ENGINE_STYLE: Record<AiEngine, { short: string; className: string }> = {
  chatgpt: { short: "GPT", className: "bg-emerald-50 text-emerald-700 ring-emerald-100" },
  gemini: { short: "Gem", className: "bg-sky-50 text-sky-700 ring-sky-100" },
  claude: { short: "Cla", className: "bg-orange-50 text-orange-700 ring-orange-100" },
  perplexity: { short: "Px", className: "bg-cyan-50 text-cyan-700 ring-cyan-100" },
  google_ai_overview: { short: "G", className: "bg-violet-50 text-violet-700 ring-violet-100" },
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
        "flex items-center gap-1.5 rounded-lg border px-2 py-1.5",
        mentioned ? "border-emerald-100 bg-emerald-50/40" : "border-zinc-100 bg-white"
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
      <span
        className={cn(
          "text-[10px] font-semibold",
          mentioned ? "text-emerald-600" : "text-zinc-300"
        )}
      >
        {mentioned ? "✓" : "—"}
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
  const mentions = data.mentions.slice(0, 4);

  return (
    <article className={dashboardCardClass("flex h-full flex-col")}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className={dashboardCardTitle}>AI Visibility</h2>
          {runLabel && <p className={cn(dashboardCardMeta, "mt-0.5")}>Last check {runLabel}</p>}
        </div>
        <Link href={`/businesses/${businessId}/ai-visibility`} className={dashboardAccentLink}>
          Open
        </Link>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {data.visibilityScore != null && (
          <div className="flex items-baseline gap-1">
            <span className={dashboardSectionLabel}>Score</span>
            <span className="text-lg font-semibold tabular-nums tracking-tight text-zinc-900">
              {Math.round(data.visibilityScore)}
            </span>
            <span className="text-[11px] text-zinc-400">/100</span>
          </div>
        )}
        <span
          className={cn(
            dashboardBadge,
            data.targetMentioned
              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
              : "bg-zinc-100 text-zinc-600"
          )}
        >
          {data.targetMentioned ? "Mentioned" : "Not mentioned"}
        </span>
        <span className={dashboardMicro}>
          <span className="font-semibold text-zinc-700">{data.companyCount}</span> tracked
        </span>
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
        <p className={cn(dashboardMicro, "mt-2 line-clamp-1 rounded-md bg-zinc-50 px-2 py-1.5")}>
          <span className="font-medium text-zinc-500">Prompt ·</span> {data.primaryPrompt}
        </p>
      )}

      {mentions.length > 0 && (
        <div className="mt-3 border-t border-zinc-100 pt-2.5">
          <p className={dashboardSectionLabel}>Top mentions</p>
          <ul className="mt-1.5 space-y-1.5">
            {mentions.map((m) => (
              <li key={m.name} className="space-y-0.5">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span
                    className={cn(
                      "min-w-0 truncate",
                      m.isTarget ? "font-semibold text-emerald-700" : "font-medium text-zinc-700"
                    )}
                  >
                    {m.name}
                  </span>
                  <span className="shrink-0 tabular-nums text-zinc-400">
                    {m.sharePct}% · {m.engineCount}
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
        <p className={cn(dashboardBody, "mt-3 text-zinc-500")}>
          Run an AI visibility check to see model coverage.
        </p>
      )}
    </article>
  );
}
