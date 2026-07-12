"use client";

import { Columns3, Download, Info } from "lucide-react";
import type { MapPackEntry, OrganicSerpEntry, SerpMatchRow } from "@/lib/ai-visibility/types";
import { AiPanel, TintedKpiCard, VisibilityScoreRing } from "@/components/ai-visibility/ai-visibility-ui";
import { cn } from "@/lib/utils";
import { Map, Sparkles, FileText, Layers } from "lucide-react";

const placementLabel: Record<SerpMatchRow["placement"], string> = {
  both: "AI + Google",
  map_pack_only: "Map pack only",
  organic_only: "Organic only",
  ai_only: "AI Only",
};

const placementClass: Record<SerpMatchRow["placement"], string> = {
  both: "bg-emerald-100 text-emerald-800",
  map_pack_only: "bg-blue-100 text-blue-800",
  organic_only: "bg-violet-100 text-violet-800",
  ai_only: "bg-purple-100 text-purple-800",
};

function MiniSparkline({ seed }: { seed: number }) {
  const points = [12, 18 + (seed % 5), 14, 22 - (seed % 4), 16 + (seed % 3), 20];
  const coords = points.map((v, i) => `${(i / (points.length - 1)) * 48},${24 - v}`).join(" ");
  return (
    <svg viewBox="0 0 48 24" className="h-5 w-12 text-emerald-500" aria-hidden>
      <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={coords} />
    </svg>
  );
}

export function AiVisibilitySearchLandscapeTab({
  keyword,
  businessName,
  searchLocation,
  mapPack,
  organicSerp,
  serpMatches,
}: {
  keyword: string;
  businessName: string;
  searchLocation: string | null;
  mapPack: MapPackEntry[];
  organicSerp: OrganicSerpEntry[];
  serpMatches: SerpMatchRow[];
}) {
  const targetKey = businessName.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
  const isTarget = (name: string) => {
    const key = name.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
    return key.includes(targetKey) || targetKey.includes(key);
  };
  const inBoth = serpMatches.filter((m) => m.placement === "both").length;
  const aiOnly = serpMatches.filter((m) => m.placement === "ai_only").length;
  const total = serpMatches.length || 1;
  const mapPackCount = serpMatches.filter((m) => m.inMapPack).length;
  const organicCount = serpMatches.filter((m) => m.inOrganic).length;

  if (!mapPack.length && !organicSerp.length && !serpMatches.length) {
    return (
      <p className="text-sm text-text-muted">
        Run a check to fetch Google map pack and page-1 results for &ldquo;{keyword}&rdquo;. Select a specific run from the dropdown above.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TintedKpiCard
          label="AI & Google Overlap"
          value={`${inBoth} companies`}
          sub={`${Math.round((inBoth / total) * 100)}% of AI mentions also in Google top 10`}
          tint="emerald"
          icon={Layers}
        />
        <TintedKpiCard
          label="AI-Only Companies"
          value={`${aiOnly} companies`}
          sub={`${Math.round((aiOnly / total) * 100)}% appear in AI but not Google top 10`}
          tint="violet"
          icon={Sparkles}
        />
        <TintedKpiCard
          label="Map Pack Presence"
          value={`${mapPackCount} companies`}
          sub={`${Math.round((mapPackCount / total) * 100)}% of AI-mentioned in Map Pack`}
          tint="sky"
          icon={Map}
        />
        <TintedKpiCard
          label="Organic Presence"
          value={`${organicCount} companies`}
          sub={`${Math.round((organicCount / total) * 100)}% in Google Organic Results`}
          tint="amber"
          icon={FileText}
        />
      </div>

      <AiPanel
        title="AI Mentions vs Google Placement"
        subtitle="See how AI visibility compares to traditional Google rankings and map presence."
        className="overflow-hidden p-0"
        action={
          <div className="flex gap-2">
            <button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-text-muted hover:text-text">
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
            <button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-text-muted">
              <Columns3 className="h-3.5 w-3.5" />
              Columns
            </button>
          </div>
        }
      >
        <div className="flex flex-wrap gap-3 border-b border-border px-4 py-2 text-[10px] text-text-muted">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> In Map Pack</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500" /> In Organic Top 10</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-zinc-400" /> Not in Top 10</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-purple-500" /> AI Only</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-border bg-surface-subtle/80">
              <tr>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase text-text-muted">#</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase text-text-muted">Company</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase text-text-muted">AI Mentions</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase text-text-muted">AI Engine Share</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase text-zinc-500">Google Map Pack</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase text-zinc-500">Google Organic Rank</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase text-zinc-500">Overlap Status</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase text-text-muted">Score</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase text-text-muted">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {serpMatches.slice(0, 12).map((m, i) => {
                const sharePct = Math.min(100, m.aiEngineCount * 20);
                const score = m.inMapPack && m.inOrganic ? 91 : m.inMapPack ? 75 : m.inOrganic ? 60 : 40;
                return (
                  <tr key={m.normalizedName} className="hover:bg-surface-subtle/50">
                    <td className="px-3 py-3 text-text-muted">{i + 1}</td>
                    <td className="px-3 py-3 font-medium text-zinc-900">
                      {m.name}
                      {m.isTargetBrand || isTarget(m.name) ? (
                        <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                          You
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-center tabular-nums">{m.aiEngineCount}/5</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-subtle">
                          <div className="h-full bg-emerald-500" style={{ width: `${sharePct}%` }} />
                        </div>
                        <span className="text-xs tabular-nums text-text-muted">{sharePct}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      {m.mapPackPosition ? (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-800">#{m.mapPackPosition}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {m.organicPosition ? (
                        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-semibold text-blue-800">#{m.organicPosition}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", placementClass[m.placement])}>
                        {placementLabel[m.placement]}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <VisibilityScoreRing score={score} />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <MiniSparkline seed={i} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-text-muted">
          <button type="button" className="font-medium text-emerald-700 hover:underline">
            View all {serpMatches.length} AI-mentioned companies →
          </button>
          <span>Showing 1–{Math.min(5, serpMatches.length)} of {serpMatches.length}</span>
        </div>
      </AiPanel>

      <div className="grid gap-4 lg:grid-cols-3">
        <AiPanel title="Google Map Pack (Top 3)" action={<Info className="h-3.5 w-3.5 text-zinc-300" />}>
          <ol className="space-y-2">
            {mapPack.slice(0, 3).map((m) => (
              <li key={m.position} className="flex gap-2 text-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">
                  {m.position}
                </span>
                <div>
                  <p className="font-medium">{m.title}</p>
                  {(m.rating != null || m.reviewCount != null) && (
                    <p className="text-xs text-text-muted">
                      {m.rating != null ? `${m.rating}★` : ""}
                      {m.reviewCount != null ? ` · ${m.reviewCount} reviews` : ""}
                    </p>
                  )}
                  {m.address && <p className="text-[10px] text-text-muted">{m.address}</p>}
                </div>
              </li>
            ))}
          </ol>
          <button type="button" className="mt-3 text-xs font-medium text-emerald-700 hover:underline">
            View full map pack results →
          </button>
        </AiPanel>

        <AiPanel title="Google Organic Results (Top 10)" action={<Info className="h-3.5 w-3.5 text-zinc-300" />}>
          <ol className="space-y-2">
            {organicSerp.slice(0, 5).map((o) => (
              <li key={o.position} className="text-sm">
                <p className="font-medium text-text">
                  {o.position}. {o.title}
                </p>
                {o.domain && <p className="truncate text-xs text-text-muted">{o.domain}</p>}
                <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-primary">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  AI mentioned
                </span>
              </li>
            ))}
          </ol>
          <button type="button" className="mt-3 text-xs font-medium text-emerald-700 hover:underline">
            View all organic results →
          </button>
        </AiPanel>

        <AiPanel title="Landscape Insights" action={<Info className="h-3.5 w-3.5 text-zinc-300" />}>
          <ul className="space-y-3 text-xs text-text-muted">
            <li className="flex gap-2">
              <span className="text-primary">✓</span>
              <div>
                <p className="font-semibold text-text">Strong Overlap</p>
                <p>{inBoth} companies appear in both AI and Google top 10.</p>
              </div>
            </li>
            <li className="flex gap-2">
              <span className="text-violet-600">★</span>
              <div>
                <p className="font-semibold text-text">AI Opportunity</p>
                <p>{aiOnly} companies are AI-only — gaps in traditional SEO.</p>
              </div>
            </li>
            <li className="flex gap-2">
              <span className="text-amber-600">📍</span>
              <div>
                <p className="font-semibold text-text">Map Pack Advantage</p>
                <p>{mapPackCount} AI-mentioned businesses rank in the map pack.</p>
              </div>
            </li>
          </ul>
          <button type="button" className="mt-4 w-full rounded-md border border-border py-2 text-xs font-medium text-text hover:bg-surface-subtle">
            View all insights →
          </button>
        </AiPanel>
      </div>
    </div>
  );
}
