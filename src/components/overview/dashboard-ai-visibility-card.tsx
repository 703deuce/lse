import Link from "next/link";
import type { AiEngine } from "@/lib/ai-visibility/types";
import type { DashboardAiVisibility } from "@/lib/overview/load-dashboard-featured";
import { cn } from "@/lib/utils";

const ENGINE_STYLE: Record<
  AiEngine,
  { short: string; className: string }
> = {
  chatgpt: { short: "GPT", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  gemini: { short: "Gem", className: "bg-blue-50 text-blue-700 ring-blue-200" },
  claude: { short: "Cla", className: "bg-orange-50 text-orange-700 ring-orange-200" },
  perplexity: { short: "Px", className: "bg-cyan-50 text-cyan-700 ring-cyan-200" },
  google_ai_overview: { short: "G", className: "bg-violet-50 text-violet-700 ring-violet-200" },
};

function EngineBadge({
  engine,
  label,
  mentioned,
}: {
  engine: AiEngine;
  label: string;
  mentioned: boolean;
}) {
  const style = ENGINE_STYLE[engine];
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold ring-1",
          style.className
        )}
      >
        {style.short}
      </span>
      <span className="min-w-0 truncate text-zinc-700">{label}</span>
      <span
        className={cn(
          "ml-auto text-[11px] font-semibold",
          mentioned ? "text-emerald-600" : "text-zinc-300"
        )}
      >
        {mentioned ? "✓" : "✕"}
      </span>
    </div>
  );
}

export function DashboardAiVisibilityCard({
  businessId,
  data,
}: {
  businessId: string;
  data: DashboardAiVisibility;
}) {
  return (
    <article className="flex h-full flex-col rounded-xl border border-zinc-200/80 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-900">AI Visibility</h2>
        <Link
          href={`/businesses/${businessId}/ai-visibility`}
          className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
        >
          Open results →
        </Link>
      </div>

      <div className="mt-2 space-y-1.5">
        {data.engines.map((e) => (
          <EngineBadge
            key={e.engine}
            engine={e.engine}
            label={e.label}
            mentioned={e.mentioned}
          />
        ))}
      </div>

      <div className="mt-3 border-t border-zinc-100 pt-2.5">
        <p className="text-[11px] text-zinc-500">
          <span className="font-semibold text-zinc-800">{data.companyCount}</span> companies
          mentioned
        </p>
        {data.topMentions.length > 0 && (
          <ul className="mt-1.5 space-y-0.5 text-xs text-zinc-600">
            {data.topMentions.map((name) => (
              <li key={name} className="truncate">
                • {name}
              </li>
            ))}
          </ul>
        )}
      </div>

      {!data.hasData && (
        <p className="mt-2 text-xs text-zinc-500">Run an AI visibility check to see model coverage.</p>
      )}
    </article>
  );
}
