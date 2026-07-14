"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Info,
  Link2,
  Loader2,
  MoreHorizontal,
  Sparkles,
  Zap,
  ArrowUpDown,
} from "lucide-react";
import {
  DISPLAY_GROUP_ORDER,
  MOCKUP_GROUP_LABELS,
  OPPORTUNITY_TYPE_LABELS,
  type OpportunityDisplayGroup,
  type OpportunityType,
} from "@/lib/local-trust/types";
import {
  ScoreDiamond,
  TrustFilterBar,
  TrustFilterSelect,
  TrustSearchInput,
  localMatchDisplay,
  trustDifficultyBadge,
  trustPriorityBadge,
} from "@/components/local-trust/local-trust-ui";
import { dashboardCard } from "@/components/overview/dashboard-ui";
import { cn } from "@/lib/utils";

const PAGE_SIZES = [10, 20, 50] as const;

type OppRow = Record<string, unknown>;

function typeLabel(t: string) {
  return (
    MOCKUP_GROUP_LABELS[t as OpportunityDisplayGroup] ??
    OPPORTUNITY_TYPE_LABELS[t as OpportunityType] ??
    t.replace(/_/g, " ")
  );
}

function matchesLocalFilter(row: OppRow, filter: string): boolean {
  if (filter === "all") return true;
  if (filter === "city") return !!row.city_match;
  if (filter === "county") return !!row.county_match;
  if (filter === "both") return !!row.city_match && !!row.county_match;
  return true;
}

function avgScore(rows: OppRow[]): number {
  if (!rows.length) return 0;
  const sum = rows.reduce((s, r) => s + Number(r.relevance_score ?? 0), 0);
  return Math.round(sum / rows.length);
}

function OpportunityTable({ rows, showMarketBadge }: { rows: OppRow[]; showMarketBadge?: boolean }) {
  if (!rows.length) {
    return <p className="px-3 py-6 text-center text-[13px] text-zinc-500">No results in this category.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-[12px]">
        <thead className="border-b border-zinc-100 bg-zinc-50/80 text-left text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-3.5 py-2">Opportunity</th>
            <th className="px-3.5 py-2">Type</th>
            <th className="px-3.5 py-2">Local Match</th>
            <th className="px-3.5 py-2">
              <span className="inline-flex items-center gap-1">
                Score
                <Info className="h-3 w-3 text-zinc-400" />
              </span>
            </th>
            <th className="px-3.5 py-2">Difficulty</th>
            <th className="px-3.5 py-2">Priority</th>
            <th className="px-3.5 py-2">Suggested Action</th>
            <th className="w-10 px-3.5 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map((row) => {
            const raw = row.raw_json as Record<string, unknown> | undefined;
            const verification = raw?.verification as Record<string, unknown> | undefined;
            const actionText = String(verification?.nextAction ?? row.suggested_action ?? "—");
            const score = Number(row.relevance_score ?? 0);
            return (
              <tr key={String(row.id ?? row.url)} className="align-top hover:bg-zinc-50/80">
                <td className="px-3.5 py-2">
                  <div className="flex items-start gap-1.5">
                    <a
                      href={String(row.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-zinc-900 hover:text-emerald-700"
                    >
                      {String(row.title)}
                    </a>
                    <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-zinc-400" />
                  </div>
                  <p className="mt-0.5 text-[11px] text-zinc-400">{String(row.domain ?? "")}</p>
                  {showMarketBadge && row.market_city != null && row.market_state != null ? (
                    <span className="mt-1 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 ring-1 ring-emerald-100">
                      {String(row.market_city)}, {String(row.market_state)}
                    </span>
                  ) : null}
                </td>
                <td className="px-3.5 py-2 text-[11px] text-zinc-600">
                  {typeLabel(
                    String(raw?.displayGroup ?? row.opportunity_type)
                  )}
                </td>
                <td className="px-3.5 py-2">{localMatchDisplay(!!row.city_match, !!row.county_match)}</td>
                <td className="px-3.5 py-2">
                  <ScoreDiamond score={score} />
                </td>
                <td className="px-3.5 py-2">{trustDifficultyBadge(String(row.difficulty))}</td>
                <td className="px-3.5 py-2">{trustPriorityBadge(String(row.priority))}</td>
                <td className="max-w-xs px-3.5 py-2 text-[11px] leading-snug text-zinc-600">{actionText}</td>
                <td className="px-3.5 py-2">
                  <button type="button" className="rounded p-1 text-zinc-400 hover:bg-zinc-100">
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (p: number) => void;
}) {
  if (totalItems <= pageSize) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between border-t border-zinc-100 px-3.5 py-2 text-[11px] text-zinc-500">
      <span>
        Showing {from} to {to} of {totalItems} results
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="flex h-7 w-7 items-center justify-center rounded border border-zinc-200 hover:bg-zinc-50 disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="px-2 tabular-nums">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="flex h-7 w-7 items-center justify-center rounded border border-zinc-200 hover:bg-zinc-50 disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

type TypeCount = { type: string; count: number };

export function LocalTrustOpportunitiesPanel({
  businessId,
  easyWins = 0,
  totalOpportunities = 0,
  marketCity,
  marketState,
  allMarkets,
}: {
  businessId: string;
  easyWins?: number;
  totalOpportunities?: number;
  marketCity?: string | null;
  marketState?: string | null;
  allMarkets?: boolean;
}) {
  const [pageSize, setPageSize] = useState<number>(10);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [groupPages, setGroupPages] = useState<Record<string, number>>({});
  const [localMatchFilter, setLocalMatchFilter] = useState("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [expandedInit, setExpandedInit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<OppRow[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<TypeCount[]>([]);
  const [groupItems, setGroupItems] = useState<Record<string, OppRow[]>>({});
  const [groupTotals, setGroupTotals] = useState<Record<string, number>>({});
  const [groupLoading, setGroupLoading] = useState<Record<string, boolean>>({});

  const fetchPage = useCallback(
    async (opts: { type?: string | null; pageNum: number; pageSz: number }) => {
      const params = new URLSearchParams({
        page: String(opts.pageNum),
        pageSize: String(opts.pageSz),
      });
      if (opts.type) {
        if (DISPLAY_GROUP_ORDER.includes(opts.type as OpportunityDisplayGroup)) {
          params.set("group", opts.type);
        } else {
          params.set("type", opts.type);
        }
      }
      if (priorityFilter !== "all") params.set("priority", priorityFilter);
      if (allMarkets) params.set("allMarkets", "true");
      else if (marketCity && marketState) {
        params.set("marketCity", marketCity);
        params.set("marketState", marketState);
      }
      const res = await fetch(`/api/trust/${businessId}/opportunities?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      let rows = json.items as OppRow[];
      if (difficultyFilter !== "all") {
        rows = rows.filter((r) => String(r.difficulty) === difficultyFilter);
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        rows = rows.filter(
          (r) =>
            String(r.title).toLowerCase().includes(q) ||
            String(r.domain ?? "").toLowerCase().includes(q)
        );
      }
      if (localMatchFilter !== "all") {
        rows = rows.filter((r) => matchesLocalFilter(r, localMatchFilter));
      }
      return { items: rows, total: json.total as number };
    },
    [businessId, priorityFilter, difficultyFilter, search, localMatchFilter, marketCity, marketState, allMarkets]
  );

  const loadCounts = useCallback(async () => {
    const params = new URLSearchParams();
    if (allMarkets) params.set("allMarkets", "true");
    else if (marketCity && marketState) {
      params.set("marketCity", marketCity);
      params.set("marketState", marketState);
    }
    const qs = params.toString();
    const res = await fetch(`/api/trust/${businessId}/counts${qs ? `?${qs}` : ""}`);
    const json = await res.json();
    if (res.ok) setCounts(json.counts ?? []);
  }, [businessId, marketCity, marketState, allMarkets]);

  useEffect(() => {
    void loadCounts();
  }, [loadCounts]);

  useEffect(() => {
    if (typeFilter !== "all") {
      setLoading(true);
      fetchPage({ type: typeFilter, pageNum: page, pageSz: pageSize })
        .then(({ items: rows, total: t }) => {
          setItems(rows);
          setTotal(t);
        })
        .catch(() => {
          setItems([]);
          setTotal(0);
        })
        .finally(() => setLoading(false));
    }
  }, [typeFilter, page, pageSize, fetchPage]);

  const loadGroupPage = useCallback(
    async (type: string, pageNum: number) => {
      setGroupLoading((g) => ({ ...g, [type]: true }));
      try {
        const { items: rows, total: t } = await fetchPage({ type, pageNum, pageSz: pageSize });
        setGroupItems((g) => ({ ...g, [type]: rows }));
        setGroupTotals((g) => ({ ...g, [type]: t }));
      } finally {
        setGroupLoading((g) => ({ ...g, [type]: false }));
      }
    },
    [fetchPage, pageSize]
  );

  const orderedTypes = DISPLAY_GROUP_ORDER.filter((t) => counts.some((c) => c.type === t && c.count > 0));
  const extraTypes = counts
    .map((c) => c.type)
    .filter((t) => !DISPLAY_GROUP_ORDER.includes(t as OpportunityDisplayGroup));
  const groupedTypesKey = [...orderedTypes, ...extraTypes].join(",");
  const groupedTypes = groupedTypesKey ? groupedTypesKey.split(",").filter(Boolean) : [];

  useEffect(() => {
    if (!expandedInit && groupedTypes.length > 0) {
      setExpanded({ [groupedTypes[0]]: true });
      setExpandedInit(true);
    }
  }, [groupedTypes, expandedInit]);

  useEffect(() => {
    if (typeFilter !== "all" || !groupedTypesKey) return;
    const types = groupedTypesKey.split(",").filter(Boolean);
    for (const type of types) {
      const isOpen = expanded[type] ?? false;
      if (isOpen) {
        const p = groupPages[type] ?? 1;
        void loadGroupPage(type, p);
      }
    }
  }, [typeFilter, groupedTypesKey, expanded, groupPages, pageSize, priorityFilter, difficultyFilter, search, localMatchFilter, loadGroupPage]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const oppTotal = totalOpportunities || counts.reduce((s, c) => s + c.count, 0);
  const categoryCount = groupedTypes.length;
  const highImpact = counts.filter((c) => c.count >= 2).reduce((s, c) => s + c.count, 0);

  return (
    <div className="space-y-3">
      <TrustFilterBar>
        <TrustFilterSelect
          label="Category"
          value={typeFilter}
          onChange={(v) => {
            setTypeFilter(v);
            setPage(1);
            setGroupPages({});
          }}
          options={[
            { value: "all", label: "All categories (grouped)" },
            ...groupedTypes.map((t) => ({
              value: t,
              label: `${typeLabel(t)} (${counts.find((c) => c.type === t)?.count ?? 0})`,
            })),
          ]}
        />
        <TrustFilterSelect
          label="Priority"
          value={priorityFilter}
          onChange={(v) => {
            setPriorityFilter(v);
            setPage(1);
            setGroupPages({});
          }}
          options={[
            { value: "all", label: "All priorities" },
            { value: "high", label: "High" },
            { value: "medium", label: "Medium" },
            { value: "low", label: "Low" },
          ]}
        />
        <TrustFilterSelect
          label="Difficulty"
          value={difficultyFilter}
          onChange={(v) => {
            setDifficultyFilter(v);
            setPage(1);
            setGroupPages({});
          }}
          options={[
            { value: "all", label: "All difficulty" },
            { value: "easy", label: "Easy" },
            { value: "medium", label: "Medium" },
            { value: "hard", label: "Hard" },
          ]}
        />
        <TrustFilterSelect
          label="Local Match"
          value={localMatchFilter}
          onChange={(v) => {
            setLocalMatchFilter(v);
            setPage(1);
            setGroupPages({});
          }}
          options={[
            { value: "all", label: "All local match" },
            { value: "city", label: "City match" },
            { value: "county", label: "County match" },
          ]}
        />
        <TrustSearchInput value={search} onChange={setSearch} placeholder="Search opportunities..." />
        <TrustFilterSelect
          label="Per page"
          value={String(pageSize)}
          onChange={(v) => {
            setPageSize(Number(v));
            setPage(1);
            setGroupPages({});
          }}
          options={PAGE_SIZES.map((n) => ({ value: String(n), label: String(n) }))}
        />
        <p className="ml-auto flex items-center gap-1 self-end pb-1.5 text-[11px] text-zinc-500">
          <ArrowUpDown className="h-3.5 w-3.5" />
          Sorted by relevance score (high to low)
        </p>
      </TrustFilterBar>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="flex items-center gap-2 rounded-lg border border-zinc-200/70 bg-white px-3.5 py-2.5 shadow-sm">
          <Sparkles className="h-4 w-4 text-blue-500" />
          <div>
            <p className="text-[13px] font-semibold text-zinc-900">{oppTotal} opportunities</p>
            <p className="text-[11px] text-zinc-500">Across {categoryCount} categories</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5">
          <Zap className="h-4 w-4 text-emerald-600" />
          <div>
            <p className="text-[13px] font-semibold text-emerald-900">{easyWins} Easy wins</p>
            <p className="text-[11px] text-emerald-700">Low effort, high impact</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2.5">
          <Link2 className="h-4 w-4 text-blue-600" />
          <div>
            <p className="text-[13px] font-semibold text-blue-900">{highImpact} High-impact actions</p>
            <p className="text-[11px] text-blue-700">Stronger local authority</p>
          </div>
        </div>
      </div>

      {typeFilter !== "all" ? (
        <div className={cn(dashboardCard, "overflow-hidden")}>
          <div className="border-b border-zinc-100 px-3.5 py-2">
            <h3 className="text-[13px] font-semibold text-zinc-900">{typeLabel(typeFilter)}</h3>
            <p className="text-[11px] text-zinc-500">{total} opportunities</p>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-8 text-zinc-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : (
            <>
              <OpportunityTable rows={items} showMarketBadge={allMarkets} />
              <Pagination
                page={page}
                totalPages={totalPages}
                totalItems={total}
                pageSize={pageSize}
                onPageChange={setPage}
              />
            </>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {groupedTypes.length === 0 && !loading && (
            <p className="text-[13px] text-zinc-500">No opportunities yet. Run the finder to discover local trust opportunities.</p>
          )}
          {groupedTypes.map((type) => {
            const isOpen = expanded[type] ?? false;
            const count = counts.find((c) => c.type === type)?.count ?? groupTotals[type] ?? 0;
            const gPage = groupPages[type] ?? 1;
            const gTotalPages = Math.max(1, Math.ceil((groupTotals[type] ?? count) / pageSize));
            const rows = groupItems[type] ?? [];
            const avg = avgScore(rows);

            return (
              <div key={type} className={cn(dashboardCard, "overflow-hidden")}>
                <button
                  type="button"
                  onClick={() => setExpanded((e) => ({ ...e, [type]: !isOpen }))}
                  className="flex w-full items-center gap-2 border-b border-zinc-100 bg-white px-3.5 py-2.5 text-left hover:bg-zinc-50/80"
                >
                  {isOpen ? (
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                  )}
                  <span className="flex-1 text-[13px] font-semibold text-zinc-900">{typeLabel(type)}</span>
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-zinc-100 px-1.5 text-[11px] font-semibold text-zinc-600">
                    {count}
                  </span>
                  <span className="text-[11px] text-zinc-500">Avg. Score: {avg || "—"}</span>
                </button>
                {isOpen && (
                  <>
                    {groupLoading[type] ? (
                      <div className="flex items-center justify-center py-6 text-zinc-500">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading…
                      </div>
                    ) : (
                      <>
                        <OpportunityTable rows={rows} showMarketBadge={allMarkets} />
                        <Pagination
                          page={gPage}
                          totalPages={gTotalPages}
                          totalItems={groupTotals[type] ?? count}
                          pageSize={pageSize}
                          onPageChange={(p) => setGroupPages((gp) => ({ ...gp, [type]: p }))}
                        />
                      </>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
