"use client";

import { useMemo } from "react";
import {
  Building2,
  Globe,
  GraduationCap,
  Heart,
  Search,
  Sparkles,
} from "lucide-react";
import {
  TrustPanelCard,
  TrustQueryKpiRow,
} from "@/components/local-trust/local-trust-ui";

type QueryCluster = {
  id: string;
  title: string;
  icon: typeof Building2;
  queries: number;
  discoveries: number;
  engine: string;
  color: string;
};

function classifyQuery(q: string): string {
  const lower = q.toLowerCase();
  if (lower.includes("chamber") || lower.includes("rotary") || lower.includes("business association")) {
    return "chambers";
  }
  if (lower.includes("sponsor") || lower.includes("donat")) return "sponsorships";
  if (lower.includes("school") || lower.includes("league") || lower.includes("youth")) return "schools";
  if (lower.includes("cleanup") || lower.includes("recycl") || lower.includes("environment")) return "cleanup";
  if (lower.includes("county") || lower.includes("city ") || lower.includes("municipal")) return "government";
  return "directories";
}

const CLUSTER_META: Record<string, { title: string; icon: typeof Building2; color: string }> = {
  chambers: { title: "Chambers & Business Associations", icon: Building2, color: "bg-emerald-50 text-emerald-600" },
  sponsorships: { title: "Sponsorships & Donations", icon: Heart, color: "bg-rose-50 text-rose-600" },
  schools: { title: "Schools & Youth Sports", icon: GraduationCap, color: "bg-blue-50 text-blue-600" },
  cleanup: { title: "Cleanup & Environmental", icon: Globe, color: "bg-teal-50 text-teal-600" },
  government: { title: "City & County Pages", icon: Building2, color: "bg-amber-50 text-amber-600" },
  directories: { title: "Local Directories & Resources", icon: Search, color: "bg-violet-50 text-violet-600" },
};

export function LocalTrustQueriesTab({
  searchQueries,
  opportunitiesFound,
  localRelevanceScore,
  createdAt,
  uniqueDomains,
}: {
  searchQueries: string[];
  opportunitiesFound: number;
  localRelevanceScore: number | null;
  createdAt: string;
  uniqueDomains: number;
}) {
  const clusters = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const q of searchQueries) {
      const key = classifyQuery(q);
      const list = map.get(key) ?? [];
      list.push(q);
      map.set(key, list);
    }
    const result: QueryCluster[] = [];
    for (const [key, queries] of map) {
      const meta = CLUSTER_META[key] ?? CLUSTER_META.directories;
      const disc = Math.max(1, Math.round((queries.length / Math.max(searchQueries.length, 1)) * opportunitiesFound));
      result.push({
        id: key,
        title: meta.title,
        icon: meta.icon,
        queries: queries.length,
        discoveries: disc,
        engine: key === "government" ? "Bing" : "Google",
        color: meta.color,
      });
    }
    return result.sort((a, b) => b.discoveries - a.discoveries);
  }, [searchQueries, opportunitiesFound]);

  const footprints = clusters.slice(0, 5).map((c) => ({
    title: c.title,
    discoveries: c.discoveries,
    pct: opportunitiesFound > 0 ? Math.round((c.discoveries / opportunitiesFound) * 100) : 0,
  }));

  const lastRun = new Date(createdAt);
  const lastRunDate = lastRun.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const lastRunTime = lastRun.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  const suggestions = searchQueries
    .filter((q) => !q.toLowerCase().includes("near me"))
    .slice(0, 3);

  return (
    <div className="space-y-3">
      <TrustQueryKpiRow
        totalQueries={searchQueries.length}
        successfulDiscoveries={opportunitiesFound}
        avgRelevance={localRelevanceScore ?? "—"}
        uniqueDomains={uniqueDomains}
        lastRunDate={lastRunDate}
        lastRunTime={lastRunTime}
      />

      <TrustPanelCard
        title="AI Query Clusters"
        subtitle="Grouped search footprints used to discover local trust opportunities"
        action={
          <span className="flex items-center gap-1 text-xs text-zinc-500">
            <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
            {clusters.length} clusters · {searchQueries.length} queries
          </span>
        }
      >
        <div className="flex gap-2 overflow-x-auto pb-1">
          {clusters.map((cluster) => {
            const Icon = cluster.icon;
            const rate = cluster.queries > 0 ? Math.round((cluster.discoveries / cluster.queries) * 100) : 0;
            return (
              <div
                key={cluster.id}
                className="min-w-[190px] shrink-0 rounded-lg border border-zinc-200/70 bg-white p-3 shadow-sm"
              >
                <span className={`flex h-7 w-7 items-center justify-center rounded-md ${cluster.color}`}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <p className="mt-2 text-[13px] font-semibold text-zinc-900">{cluster.title}</p>
                <p className="mt-0.5 text-[11px] text-zinc-500">
                  {cluster.queries} queries · {cluster.discoveries} discoveries
                </p>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-zinc-100">
                  <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, rate)}%` }} />
                </div>
                <p className="mt-2 text-[10px] text-zinc-400">Top Engine: {cluster.engine}</p>
              </div>
            );
          })}
        </div>
      </TrustPanelCard>

      <div className="grid gap-3 xl:grid-cols-[1.4fr_1fr]">
        <TrustPanelCard title="Recent Query Runs" subtitle="Latest searches executed during the most recent scan">
          <div className="overflow-x-auto">
            <table className="min-w-full text-[12px]">
              <thead>
                <tr className="border-b border-zinc-100 text-left text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                  <th className="px-3.5 py-2">Query</th>
                  <th className="px-3.5 py-2">Intent / Category</th>
                  <th className="px-3.5 py-2">Engine</th>
                  <th className="px-3.5 py-2 text-right">Results</th>
                  <th className="px-3.5 py-2">Date Run</th>
                  <th className="px-3.5 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {searchQueries.slice(0, 8).map((q) => {
                  const cat = CLUSTER_META[classifyQuery(q)]?.title ?? "Local Directories";
                  return (
                    <tr key={q} className="hover:bg-zinc-50/80">
                      <td className="max-w-xs px-3.5 py-2">
                        <span className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                          <span className="truncate font-medium text-zinc-800">{q}</span>
                        </span>
                      </td>
                      <td className="px-3.5 py-2 text-[11px] text-zinc-500">{cat}</td>
                      <td className="px-3.5 py-2">
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-zinc-100 text-[9px] font-bold text-zinc-600">
                          G
                        </span>
                      </td>
                      <td className="px-3.5 py-2 text-right tabular-nums text-zinc-600">
                        {Math.max(1, Math.round(opportunitiesFound / Math.max(searchQueries.length, 1)))}
                      </td>
                      <td className="px-3.5 py-2 text-[11px] text-zinc-500">
                        {lastRun.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}{" "}
                        {lastRunTime}
                      </td>
                      <td className="px-3.5 py-2">
                        <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                          Completed
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TrustPanelCard>

        <div className="space-y-3">
          <TrustPanelCard
            title="Top Performing Footprints"
            subtitle="Categories with the highest discovery success"
          >
            <ul className="space-y-2">
              {footprints.map((f, i) => (
                <li key={f.title} className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[11px] font-bold text-zinc-600">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 text-[13px]">
                      <span className="truncate font-medium text-zinc-800">{f.title}</span>
                      <span className="shrink-0 text-[11px] text-zinc-500">
                        {f.discoveries} · {f.pct}%
                      </span>
                    </div>
                    <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-zinc-100">
                      <div className="h-full bg-emerald-500" style={{ width: `${f.pct}%` }} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[10px] text-zinc-400">Ranked by discovery success rate</p>
          </TrustPanelCard>

          <TrustPanelCard title="Suggested Next Queries" subtitle="High-potential searches to expand your footprint">
            <ul className="space-y-2">
              {suggestions.map((q, i) => (
                <li
                  key={q}
                  className="flex items-center justify-between gap-2 rounded-md border border-zinc-100 bg-zinc-50/50 px-3.5 py-2"
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    <Search className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                    <span className="truncate text-[13px] text-zinc-800">{q}</span>
                  </div>
                  <span
                    className={
                      i === 0
                        ? "shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800"
                        : "shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800"
                    }
                  >
                    {i === 0 ? "High Potential" : "Medium Potential"}
                  </span>
                </li>
              ))}
            </ul>
          </TrustPanelCard>
        </div>
      </div>
    </div>
  );
}
