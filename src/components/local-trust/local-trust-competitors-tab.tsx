"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Loader2,
  MoreVertical,
  Sparkles,
} from "lucide-react";
import { OPPORTUNITY_TYPE_LABELS, type OpportunityType } from "@/lib/local-trust/types";
import {
  AuthorityRing,
  TrustFilterSelect,
  TrustSearchInput,
  domainInitials,
  localMatchDisplay,
  trustPriorityBadge,
} from "@/components/local-trust/local-trust-ui";
import { dashboardCard } from "@/components/overview/dashboard-ui";
import { cn } from "@/lib/utils";

type OppRow = Record<string, unknown>;

const MENTION_TYPE_COLORS: Record<string, string> = {
  chamber: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  city_county: "bg-blue-50 text-blue-700 ring-blue-100",
  local_directory: "bg-violet-50 text-violet-700 ring-violet-100",
  charity: "bg-rose-50 text-rose-700 ring-rose-100",
  school_sponsor: "bg-amber-50 text-amber-700 ring-amber-100",
  community_event: "bg-teal-50 text-teal-700 ring-teal-100",
  other: "bg-zinc-50 text-zinc-700 ring-zinc-100",
};

function mentionTypeLabel(t: string) {
  return OPPORTUNITY_TYPE_LABELS[t as OpportunityType] ?? t.replace(/_/g, " ");
}

function mentionTypeBadge(type: string) {
  const short =
    type === "chamber"
      ? "Chamber"
      : type === "city_county"
        ? "Community Page"
        : type === "local_directory"
          ? "Directory"
          : mentionTypeLabel(type).split("/")[0]?.trim() ?? type;
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1",
        MENTION_TYPE_COLORS[type] ?? MENTION_TYPE_COLORS.other
      )}
    >
      {short}
    </span>
  );
}

export function LocalTrustCompetitorsTab({
  businessId,
  marketCity,
  marketState,
  allMarkets,
}: {
  businessId: string;
  marketCity?: string | null;
  marketState?: string | null;
  allMarkets?: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<OppRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        competitorPresent: "true",
      });
      if (priorityFilter !== "all") params.set("priority", priorityFilter);
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (allMarkets) params.set("allMarkets", "true");
      else if (marketCity && marketState) {
        params.set("marketCity", marketCity);
        params.set("marketState", marketState);
      }
      const res = await fetch(`/api/trust/${businessId}/opportunities?${params}`);
      const json = await res.json();
      if (res.ok) {
        setItems(json.items ?? []);
        setTotal(json.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [businessId, page, pageSize, priorityFilter, typeFilter, marketCity, marketState, allMarkets]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = items.filter((row) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      String(row.title).toLowerCase().includes(q) ||
      String(row.domain ?? "").toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-zinc-500">
          See where your top competitors are mentioned locally—and how you can get featured too.
        </p>
        <button type="button" className="text-[12px] font-medium text-emerald-700 hover:underline">
          Insights summary →
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-2.5 border-b border-zinc-100 pb-3">
        <TrustFilterSelect
          label="Competitor"
          value="all"
          onChange={() => {}}
          options={[{ value: "all", label: "All competitors" }]}
        />
        <TrustFilterSelect
          label="Mention Type"
          value={typeFilter}
          onChange={(v) => {
            setTypeFilter(v);
            setPage(1);
          }}
          options={[
            { value: "all", label: "All types" },
            ...Object.entries(OPPORTUNITY_TYPE_LABELS).map(([k, v]) => ({ value: k, label: v })),
          ]}
        />
        <TrustFilterSelect
          label="Priority"
          value={priorityFilter}
          onChange={(v) => {
            setPriorityFilter(v);
            setPage(1);
          }}
          options={[
            { value: "all", label: "All priorities" },
            { value: "high", label: "High" },
            { value: "medium", label: "Medium" },
            { value: "low", label: "Low" },
          ]}
        />
        <TrustFilterSelect
          label="Per page"
          value={String(pageSize)}
          onChange={(v) => {
            setPageSize(Number(v));
            setPage(1);
          }}
          options={[
            { value: "10", label: "10" },
            { value: "20", label: "20" },
            { value: "50", label: "50" },
          ]}
        />
        <button type="button" className="text-xs font-medium text-emerald-700 hover:underline">
          Clear filters
        </button>
        <button
          type="button"
          className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-emerald-700"
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2.5">
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
        <p className="flex-1 text-[13px] text-zinc-700">
          <strong>Competitive Insight:</strong>{" "}
          {total > 0
            ? `Found ${total} pages where competitors appear locally. Focus on chamber and community pages for the fastest gap closure.`
            : "No competitor mentions found yet in this market. Run another scan or check Opportunities for open placements."}
        </p>
        <button type="button" className="shrink-0 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50">
          View gap analysis →
        </button>
      </div>

      <div className={cn(dashboardCard, "overflow-hidden")}>
        {loading ? (
          <div className="flex items-center justify-center py-10 text-zinc-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading competitor mentions…
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-3.5 py-10 text-center text-[13px] text-zinc-500">
            No competitor mentions found for this scan. Competitors may not yet appear on local trust pages in your market.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-[12px]">
              <thead className="border-b border-zinc-100 bg-zinc-50/80 text-left text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Source / Site</th>
                  <th className="px-3 py-2">Mention Type</th>
                  <th className="px-3 py-2">Local Relevance</th>
                  <th className="px-3 py-2">Authority / Score</th>
                  <th className="px-3 py-2">Suggested Action</th>
                  <th className="w-10 px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.map((row) => {
                  const domain = String(row.domain ?? "");
                  const relevance = Number(row.relevance_score ?? 0);
                  const authority = Number(row.authority_score ?? relevance);
                  const authLabel = authority >= 70 ? "High" : authority >= 45 ? "Medium" : "Low";
                  const snippet = String(row.evidence_snippet ?? "").slice(0, 120);
                  return (
                    <tr key={String(row.id)} className="align-top hover:bg-zinc-50/80">
                      <td className="px-3 py-2.5">
                        <div className="flex items-start gap-2">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[10px] font-bold text-zinc-600">
                            {domainInitials(domain)}
                          </span>
                          <div className="min-w-0">
                            <a
                              href={String(row.url)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-[13px] font-semibold text-zinc-900 hover:text-emerald-700"
                            >
                              {String(row.title)}
                              <ExternalLink className="h-3 w-3 shrink-0 text-zinc-400" />
                            </a>
                            <p className="mt-0.5 text-[11px] text-zinc-400">{domain}</p>
                            {snippet && (
                              <p className="mt-0.5 text-[11px] italic leading-snug text-zinc-500">&ldquo;{snippet}…&rdquo;</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">{mentionTypeBadge(String(row.opportunity_type))}</td>
                      <td className="px-3 py-2.5">
                        <div className="font-semibold tabular-nums text-zinc-800">{relevance}</div>
                        <div className="mt-0.5 h-1 w-14 overflow-hidden rounded-full bg-zinc-100">
                          <div className="h-full bg-emerald-500" style={{ width: `${relevance}%` }} />
                        </div>
                        <div className="mt-0.5">{localMatchDisplay(!!row.city_match, !!row.county_match)}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <AuthorityRing score={Math.round(authority)} label={authLabel} />
                      </td>
                      <td className="max-w-xs px-3 py-2.5">
                        <p className="text-[11px] leading-snug text-zinc-600">
                          {String(row.suggested_action ?? "Reach out to get featured on this page.")}
                        </p>
                        <button
                          type="button"
                          className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50"
                        >
                          View Opportunity
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      </td>
                      <td className="px-3 py-2.5">
                        <button type="button" className="rounded p-1 text-zinc-400 hover:bg-zinc-100">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {total > 0 && (
          <div className="flex items-center justify-between border-t border-zinc-100 px-3 py-2 text-[11px] text-zinc-500">
            <span>
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} results
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="flex h-7 w-7 items-center justify-center rounded border border-zinc-200 hover:bg-zinc-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={cn(
                    "flex h-7 min-w-7 items-center justify-center rounded border px-1 text-xs font-medium",
                    p === page ? "border-emerald-600 text-emerald-700" : "border-transparent hover:bg-zinc-50"
                  )}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="flex h-7 w-7 items-center justify-center rounded border border-zinc-200 hover:bg-zinc-50 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
