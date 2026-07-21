"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bookmark,
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  Filter,
  Loader2,
  Search,
  Sparkles,
} from "lucide-react";
import {
  enrichOpportunities,
  type BusinessContext,
  type EnrichedOpportunity,
  type RawOpportunity,
} from "@/lib/backlink-gap/enrich";
import { cn } from "@/lib/utils";
import {
  gapControl,
  linkBadge,
  powerBar,
  powerSegmentBar,
  priorityBadge,
  priorityPickBadge,
  topicalBadge,
} from "@/components/backlink-gap/backlink-gap-ui";
import { mock } from "@/components/mockup/ui";

const PAGE_SIZES = [10, 25, 50, 100] as const;

const COMPETITOR_COLORS = ["bg-sky-500", "bg-violet-500", "bg-amber-500", "bg-rose-500", "bg-teal-500"];

function competitorAvatars(
  linked: Array<{ name?: string; domain?: string | null }>,
  total: number
) {
  const shown = linked.slice(0, 3);
  const extra = linked.length - shown.length;
  return (
    <div className="flex items-center -space-x-1">
      {shown.map((c, i) => (
        <span
          key={c.name ?? i}
          title={c.name}
          className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-white ${COMPETITOR_COLORS[i % COMPETITOR_COLORS.length]}`}
        >
          {(c.name ?? "?").charAt(0).toUpperCase()}
        </span>
      ))}
      {extra > 0 && (
        <span className="ml-1 text-[11px] font-medium text-[#667085]">+{extra}</span>
      )}
      {linked.length === 0 && (
        <span className="text-xs text-[#667085]">0/{total}</span>
      )}
    </div>
  );
}

function actionStatusBadge(status: string, priority: string) {
  if (status === "spam" || priority === "ignore") {
    return (
      <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 ring-1 ring-red-100">
        Spam
      </span>
    );
  }
  if (status === "ignored") {
    return (
      <span className="rounded-full bg-[#F9FAFB] px-2 py-0.5 text-[11px] font-semibold text-[#667085] ring-1 ring-zinc-200">
        Ignored
      </span>
    );
  }
  return (
    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-100">
      Review
    </span>
  );
}

function confidenceBadge(priority: string) {
  const high = priority === "high" || priority === "ignore";
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-semibold text-white",
        high ? "bg-red-500" : "bg-amber-500"
      )}
    >
      {high ? "High" : "Medium"}
    </span>
  );
}

function IgnoredTable({
  rows,
  totalCompetitors,
  onSelect,
}: {
  rows: EnrichedOpportunity[];
  totalCompetitors: number;
  onSelect: (o: EnrichedOpportunity) => void;
}) {
  if (!rows.length) {
    return <p className="px-4 py-6 text-center text-sm text-[#667085]">No ignored or spam domains match these filters.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-[13px]">
        <thead className="bg-[#F9FAFB] text-left bg-[#F9FAFB] text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-[#98A2B3]">
          <tr>
            <th className="px-4 py-3">
              <input type="checkbox" className="rounded border-[#E6EAF0]" aria-label="Select all" />
            </th>
            <th className="px-4 py-3">Domain</th>
            <th className="px-4 py-3">Power</th>
            <th className="px-4 py-3">Link type</th>
            <th className="px-4 py-3">Relevance</th>
            <th className="px-4 py-3">Source type</th>
            <th className="px-4 py-3">Reason flagged</th>
            <th className="px-4 py-3">Competitors</th>
            <th className="px-4 py-3">Action status</th>
            <th className="px-4 py-3">Confidence</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#F2F4F7]">
          {rows.map((o) => (
            <tr
              key={o.id}
              className="cursor-pointer hover:bg-[#F9FAFB]/80"
              onClick={() => onSelect(o)}
            >
              <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                <input type="checkbox" className="rounded border-[#E6EAF0]" aria-label={`Select ${o.referring_domain}`} />
              </td>
              <td className="px-4 py-3">
                <a
                  href={`https://${o.referring_domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 font-medium text-[#1570EF] hover:underline"
                >
                  {o.referring_domain}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </td>
              <td className="px-4 py-3">{powerSegmentBar(o.powerScore)}</td>
              <td className="px-4 py-3">{linkBadge(o.linkPassing)}</td>
              <td className="px-4 py-3">{topicalBadge(o.topicalFit)}</td>
              <td className="px-4 py-3 text-xs text-[#667085]">{o.source_type}</td>
              <td className="max-w-[180px] truncate px-4 py-3 text-xs text-[#667085]">
                {o.reason ?? "Spam signals detected"}
              </td>
              <td className="px-4 py-3">
                {competitorAvatars(o.linked_competitors ?? [], totalCompetitors)}
              </td>
              <td className="px-4 py-3">{actionStatusBadge(o.status, o.priority)}</td>
              <td className="px-4 py-3">{confidenceBadge(o.priority)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OpportunityTable({
  rows,
  totalCompetitors,
  onSelect,
}: {
  rows: EnrichedOpportunity[];
  totalCompetitors: number;
  onSelect: (o: EnrichedOpportunity) => void;
}) {
  if (!rows.length) {
    return <p className="px-4 py-6 text-center text-sm text-[#667085]">No results match these filters.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-[13px]">
        <thead className="bg-[#F9FAFB] text-left bg-[#F9FAFB] text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-[#98A2B3]">
          <tr>
            <th className="px-4 py-3">Domain</th>
            <th className="px-4 py-3">Power</th>
            <th className="px-4 py-3">Link type</th>
            <th className="px-4 py-3">Relevance</th>
            <th className="px-4 py-3">Source type</th>
            <th className="px-4 py-3">Anchor</th>
            <th className="px-4 py-3">Page title</th>
            <th className="px-4 py-3 text-center">Competitors</th>
            <th className="px-4 py-3">Priority</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#F2F4F7]">
          {rows.map((o) => (
            <tr
              key={o.id}
              className="cursor-pointer hover:bg-[#F9FAFB]/80"
              onClick={() => onSelect(o)}
            >
              <td className="px-4 py-3 font-medium text-[#137752]">{o.referring_domain}</td>
              <td className="px-4 py-3">{powerBar(o.powerScore)}</td>
              <td className="px-4 py-3">{linkBadge(o.linkPassing)}</td>
              <td className="px-4 py-3">{topicalBadge(o.topicalFit)}</td>
              <td className="px-4 py-3 text-xs text-[#667085]">{o.source_type}</td>
              <td className="max-w-[140px] truncate px-4 py-3 text-xs italic text-[#667085]">
                {o.anchor_text ? `"${o.anchor_text}"` : "—"}
              </td>
              <td className="max-w-[160px] truncate px-4 py-3 text-xs text-[#667085]">
                {o.source_title ?? "—"}
              </td>
              <td className="px-4 py-3 text-center text-xs font-medium">
                {o.competitor_count}/{totalCompetitors}
              </td>
              <td className="px-4 py-3">{priorityBadge(o.priority)}</td>
            </tr>
          ))}
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
  if (totalItems === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#F2F4F7] px-4 py-3 text-[11px] text-[#667085]">
      <span>
        Showing {from} to {to} of {totalItems} results
      </span>
      <div className="flex items-center gap-2">
        <select className="rounded border border-[#E6EAF0] px-2 py-0.5 text-[12px]" defaultValue={pageSize}>
          <option value={10}>10 per page</option>
          <option value={25}>25 per page</option>
        </select>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="rounded border border-[#E6EAF0] px-2 py-1 disabled:opacity-40"
          >
            ‹
          </button>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onPageChange(n)}
              className={cn(
                "min-w-[28px] rounded px-2 py-1 tabular-nums",
                page === n
                  ? "border border-[#137752] bg-[#ECFDF3] font-semibold text-[#137752]"
                  : "text-[#475467] hover:bg-[#F9FAFB]"
              )}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="rounded border border-[#E6EAF0] px-2 py-1 disabled:opacity-40"
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
}

type CompetitorCount = { name: string; domain?: string | null; count: number };

type StatsSummary = {
  total: number;
  relevance: { high: number; medium: number; low: number };
  priorities: { high: number; medium: number; low: number };
};

export function OpportunitiesPanel({
  businessId,
  competitors,
  context,
  status,
  onSelect,
}: {
  businessId: string;
  competitors: Array<{ name: string; domain?: string | null }>;
  context?: BusinessContext;
  status: "open" | "ignored";
  onSelect: (o: EnrichedOpportunity) => void;
}) {
  const [pageSize, setPageSize] = useState<number>(25);
  const [linkFilter, setLinkFilter] = useState<"all" | "dofollow" | "nofollow">("all");
  const [topicalFilter, setTopicalFilter] = useState<"all" | "topical" | "random">("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | "high" | "medium" | "low">("all");
  const [competitorFilter, setCompetitorFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [groupPages, setGroupPages] = useState<Record<string, number>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<EnrichedOpportunity[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<CompetitorCount[]>([]);
  const [groupItems, setGroupItems] = useState<Record<string, EnrichedOpportunity[]>>({});
  const [groupTotals, setGroupTotals] = useState<Record<string, number>>({});
  const [groupLoading, setGroupLoading] = useState<Record<string, boolean>>({});
  const [statsSummary, setStatsSummary] = useState<StatsSummary | null>(null);
  const [aiPicks, setAiPicks] = useState<EnrichedOpportunity[]>([]);
  const [search, setSearch] = useState("");
  const [spamFilter, setSpamFilter] = useState<"all" | "spam" | "ignored" | "review">("all");

  function resetFilters() {
    setLinkFilter("all");
    setTopicalFilter("all");
    setPriorityFilter("all");
    setCompetitorFilter("all");
    setSpamFilter("all");
    setSearch("");
    setPage(1);
    setGroupPages({});
  }

  const filteredItems = search.trim()
    ? items.filter((o) => o.referring_domain.toLowerCase().includes(search.toLowerCase()))
    : items;

  const filteredIgnoredItems = filteredItems.filter((o) => {
    if (spamFilter === "all") return true;
    if (spamFilter === "spam") return o.status === "spam" || o.priority === "ignore";
    if (spamFilter === "ignored") return o.status === "ignored";
    return o.status !== "spam" && o.status !== "ignored" && o.priority !== "ignore";
  });

  const fetchPage = useCallback(
    async (opts: {
      competitor?: string | null;
      pageNum: number;
      pageSz: number;
    }) => {
      const params = new URLSearchParams({
        page: String(opts.pageNum),
        pageSize: String(opts.pageSz),
        status,
        linkFilter,
        topicalFilter,
        priorityFilter,
      });
      if (opts.competitor) params.set("competitor", opts.competitor);

      const res = await fetch(`/api/backlink-gap/${businessId}/opportunities?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      const enriched = enrichOpportunities(json.items as RawOpportunity[], context ?? json.context);
      return { items: enriched, total: json.total as number };
    },
    [businessId, status, linkFilter, topicalFilter, priorityFilter, context]
  );

  const loadCounts = useCallback(async () => {
    const res = await fetch(`/api/backlink-gap/${businessId}/counts?status=${status}`);
    const json = await res.json();
    if (res.ok) setCounts(json.counts ?? []);
  }, [businessId, status]);

  useEffect(() => {
    if (status !== "open") return;
    fetch(`/api/backlink-gap/${businessId}/stats`)
      .then((r) => r.json())
      .then((json) => {
        setStatsSummary({
          total: json.matrixDistribution?.total ?? 0,
          relevance: json.relevance ?? { high: 0, medium: 0, low: 0 },
          priorities: json.priorities ?? { high: 0, medium: 0, low: 0 },
        });
      })
      .catch(() => setStatsSummary(null));

    fetch(`/api/backlink-gap/${businessId}/opportunities?page=1&pageSize=5&status=open&priorityFilter=high`)
      .then((r) => r.json())
      .then((json) => {
        if (json.items) {
          setAiPicks(enrichOpportunities(json.items as RawOpportunity[], context));
        }
      })
      .catch(() => setAiPicks([]));
  }, [businessId, status, context]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  useEffect(() => {
    if (competitorFilter !== "all") {
      setLoading(true);
      fetchPage({ competitor: competitorFilter, pageNum: page, pageSz: pageSize })
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
  }, [competitorFilter, page, pageSize, fetchPage]);

  const loadGroupPage = useCallback(
    async (competitorName: string, pageNum: number) => {
      setGroupLoading((g) => ({ ...g, [competitorName]: true }));
      try {
        const { items: rows, total: t } = await fetchPage({
          competitor: competitorName,
          pageNum,
          pageSz: pageSize,
        });
        setGroupItems((g) => ({ ...g, [competitorName]: rows }));
        setGroupTotals((g) => ({ ...g, [competitorName]: t }));
      } finally {
        setGroupLoading((g) => ({ ...g, [competitorName]: false }));
      }
    },
    [fetchPage, pageSize]
  );

  useEffect(() => {
    if (status !== "open") {
      setLoading(true);
      fetchPage({ pageNum: page, pageSz: pageSize })
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
  }, [status, page, pageSize, fetchPage]);

  useEffect(() => {
    if (competitorFilter !== "all" || status !== "open") return;
    // Prefetch every competitor group so switching companies is instant (no full reload).
    for (const c of competitors) {
      const p = groupPages[c.name] ?? 1;
      loadGroupPage(c.name, p);
    }
  }, [competitorFilter, competitors, groupPages, pageSize, linkFilter, topicalFilter, priorityFilter, loadGroupPage, status]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const filterSelect = cn(gapControl, "px-3 text-[13px] text-[#344054]");

  const quickFilters = [
    { id: "all", label: "All opportunities", active: priorityFilter === "all" && linkFilter === "all" },
    { id: "high", label: "Strongest links", active: priorityFilter === "high" },
    { id: "dofollow", label: "Missing links", active: linkFilter === "dofollow" },
    { id: "topical", label: "Unique links", active: topicalFilter === "topical" },
  ] as const;

  return (
    <div className="space-y-4">
      {status === "open" && (
        <div className="flex flex-wrap gap-1.5">
          {quickFilters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                if (f.id === "all") {
                  setPriorityFilter("all");
                  setLinkFilter("all");
                  setTopicalFilter("all");
                } else if (f.id === "high") {
                  setPriorityFilter("high");
                } else if (f.id === "dofollow") {
                  setLinkFilter("dofollow");
                } else if (f.id === "topical") {
                  setTopicalFilter("topical");
                }
                setPage(1);
                setGroupPages({});
              }}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[12px] font-semibold transition",
                f.active
                  ? "border-[#137752] bg-[#ECFDF3] text-[#137752]"
                  : "border-[#E6EAF0] bg-white text-[#667085] hover:bg-[#F9FAFB]"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {status === "open" && (
        <div className="flex items-start gap-3 rounded-xl border border-[#B2DDFF] bg-[#EFF8FF] px-4 py-3 text-sm text-[#175CD3]">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-bold shadow-sm">
            i
          </span>
          <p>
            Review high-power domains your competitors already earn from — prioritize topical,
            dofollow gaps first for the strongest outreach ROI.
          </p>
        </div>
      )}

      <div className={cn(mock.card, "flex flex-wrap items-center gap-2 p-2.5")}>
        <select
          value={competitorFilter}
          onChange={(e) => {
            setCompetitorFilter(e.target.value);
            setPage(1);
            setGroupPages({});
          }}
          className={filterSelect}
        >
          <option value="all">Competitors: All {competitors.length}</option>
          {competitors.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={linkFilter}
          onChange={(e) => {
            setLinkFilter(e.target.value as typeof linkFilter);
            setPage(1);
            setGroupPages({});
          }}
          className={filterSelect}
        >
          <option value="all">Link type: All link types</option>
          <option value="dofollow">Dofollow only</option>
          <option value="nofollow">Nofollow only</option>
        </select>

        <select
          value={topicalFilter}
          onChange={(e) => {
            setTopicalFilter(e.target.value as typeof topicalFilter);
            setPage(1);
            setGroupPages({});
          }}
          className={filterSelect}
        >
          <option value="all">Relevance: All relevance</option>
          <option value="topical">Topical</option>
          <option value="random">Random / generic</option>
        </select>

        <button type="button" onClick={resetFilters} className="text-[11px] font-medium text-[#667085] hover:text-[#101828]">
          Reset filters
        </button>

        {status === "ignored" && (
          <>
            <select
              value={topicalFilter}
              onChange={(e) => setTopicalFilter(e.target.value as typeof topicalFilter)}
              className={filterSelect}
            >
              <option value="all">Relevance: All relevance</option>
              <option value="topical">High</option>
              <option value="random">Low</option>
              <option value="unknown">Unclear</option>
            </select>
            <select
              value={spamFilter}
              onChange={(e) => setSpamFilter(e.target.value as typeof spamFilter)}
              className={filterSelect}
            >
              <option value="all">Spam status: All</option>
              <option value="spam">Spam</option>
              <option value="ignored">Ignored</option>
              <option value="review">Review</option>
            </select>
            <select className={filterSelect}>
              <option>Confidence: All</option>
              <option>High</option>
              <option>Medium</option>
            </select>
            <button
              type="button"
              className={cn(gapControl, "inline-flex items-center gap-1.5 px-3 font-medium")}
            >
              <Filter className="h-3.5 w-3.5" />
              More filters
            </button>
            <button
              type="button"
              className={cn(gapControl, "inline-flex items-center gap-1.5 px-3 font-medium")}
            >
              <Bookmark className="h-3.5 w-3.5" />
              Save view
            </button>
          </>
        )}

        {status === "open" && (
          <select
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value as typeof priorityFilter);
              setPage(1);
              setGroupPages({});
            }}
            className={filterSelect}
          >
            <option value="all">Priority: All priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        )}

        <div className="ml-auto flex items-center gap-2">
          {status === "ignored" && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#667085]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search domains..."
                className={cn(gapControl, "py-0 pl-8 pr-3 text-[13px]")}
              />
            </div>
          )}
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
              setGroupPages({});
            }}
            className={filterSelect}
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n} per page
              </option>
            ))}
          </select>
          <button
            type="button"
            className={cn(gapControl, "inline-flex items-center gap-1.5 px-3 font-medium")}
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
        </div>
      </div>

      {status === "open" && statsSummary && (
        <div className={cn(mock.card, "bg-[#F9FAFB] px-4 py-3")}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px]">
            <span className="font-semibold text-[#101828]">{total || statsSummary.total} Total opportunities</span>
            <span className="flex items-center gap-1.5 text-[#475467]">
              <span className="h-2 w-2 rounded-full bg-sky-500" />
              {statsSummary.relevance.high} High relevance
            </span>
            <span className="flex items-center gap-1.5 text-[#475467]">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              {statsSummary.relevance.medium} Medium relevance
            </span>
            <span className="flex items-center gap-1.5 text-[#475467]">
              <span className="h-2 w-2 rounded-full bg-zinc-400" />
              {statsSummary.relevance.low} Low relevance
            </span>
            <span className="flex items-center gap-1.5 text-[#475467]">
              <span className="h-2 w-2 rounded-full bg-[#ECFDF3]0" />
              {statsSummary.priorities.high} High priority
            </span>
            <span className="flex items-center gap-1.5 text-[#475467]">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              {statsSummary.priorities.medium} Medium priority
            </span>
            <span className="flex items-center gap-1.5 text-[#475467]">
              <span className="h-2 w-2 rounded-full bg-zinc-400" />
              {statsSummary.priorities.low} Low priority
            </span>
          </div>
        </div>
      )}

      {status === "open" && aiPicks.length > 0 && (
        <div className="rounded-xl border border-[#A6F4C5] bg-[#ECFDF3]/60 p-3.5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#D1FADF] text-[#137752]">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                <h3 className={"text-sm font-semibold text-[#101828]"}>AI Picks: Best next links to pursue</h3>
              </div>
              <p className={`mt-0.5 ${"text-[12px] text-[#667085]"}`}>
                Highest impact opportunities based on Power, Relevance, and your competitors.
              </p>
            </div>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {aiPicks.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => onSelect(o)}
                className="min-w-[180px] shrink-0 rounded-lg border border-[#E6EAF0] bg-white p-2.5 text-left shadow-sm hover:border-[#A6F4C5]"
              >
                <p className="text-[13px] font-medium text-[#101828]">{o.referring_domain}</p>
                <p className={`mt-0.5 ${"text-[12px] text-[#667085]"}`}>
                  Power {o.powerScore ?? "—"} · Relevance {o.topicalFit === "topical" ? "High" : "Medium"}
                </p>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  {priorityPickBadge(o.priority)}
                  <span className="rounded-md border border-[#A6F4C5] bg-white px-1.5 py-0.5 text-[10px] font-semibold text-[#137752]">
                    Add to tasks
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {status === "ignored" && (
        <div className={cn(mock.card, "flex flex-wrap items-center gap-2 px-4 py-2.5")}>
          <input type="checkbox" className="rounded border-[#D0D5DD]" aria-label="Select all rows" />
          <span className={"text-[12px] text-[#667085]"}>0 selected</span>
          <select className="rounded-lg border border-[#A6F4C5] px-2 py-0.5 text-[11px] font-medium text-[#137752]">
            <option>Bulk actions</option>
          </select>
          {["Mark as Ignore", "Mark as Spam", "Restore to Active", "Move to Review"].map((label) => (
            <button
              key={label}
              type="button"
              disabled
              className="rounded-lg border border-[#E6EAF0] px-2 py-0.5 text-[11px] font-medium text-[#475467]"
            >
              {label}
            </button>
          ))}
          <button type="button" disabled className="rounded-lg border border-red-100 px-2 py-0.5 text-[11px] font-medium text-red-400">
            Delete
          </button>
        </div>
      )}

      {status === "ignored" ? (
        <div className={cn(mock.card, "overflow-hidden p-0")}>
          {loading ? (
            <div className="flex items-center justify-center py-10 text-[#667085]">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : (
            <>
              <IgnoredTable
                rows={filteredIgnoredItems}
                totalCompetitors={competitors.length}
                onSelect={onSelect}
              />
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
      ) : competitorFilter !== "all" ? (
        <div className={cn(mock.card, "overflow-hidden p-0")}>
          <div className="border-b border-[#E6EAF0] px-4 py-3">
            <h3 className={"text-sm font-semibold text-[#101828]"}>{competitorFilter}</h3>
            <p className={"text-[12px] text-[#667085]"}>{total} gaps · highest power first</p>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-10 text-[#667085]">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : (
            <>
              <OpportunityTable rows={items} totalCompetitors={competitors.length} onSelect={onSelect} />
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
        <div className="space-y-2.5">
          {competitors.map((c, idx) => {
            const isOpen = expanded[c.name] ?? idx === 0;
            const count = counts.find((x) => x.name === c.name)?.count ?? groupTotals[c.name] ?? 0;
            const gPage = groupPages[c.name] ?? 1;
            const gTotalPages = Math.max(1, Math.ceil((groupTotals[c.name] ?? count) / pageSize));
            const rows = groupItems[c.name] ?? [];

            return (
              <div
                key={c.name}
                className={cn(mock.card, "overflow-hidden p-0")}
              >
                <button
                  type="button"
                  onClick={() => setExpanded((e) => ({ ...e, [c.name]: !isOpen }))}
                  className="flex w-full items-center gap-2 border-b border-[#E6EAF0] px-4 py-3 text-left hover:bg-[#F9FAFB]"
                >
                  {isOpen ? (
                    <ChevronDown className="h-3.5 w-3.5 text-[#667085]" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-[#667085]" />
                  )}
                  <div className="flex-1">
                    <span className="text-[13px] font-semibold text-[#101828]">{c.name}</span>
                    {c.domain && <span className={`ml-2 ${"text-[12px] text-[#667085]"}`}>{c.domain}</span>}
                  </div>
                  <span className="rounded-full bg-[#ECFDF3] px-2 py-0.5 text-[11px] font-semibold text-[#137752] ring-1 ring-[#A6F4C5]">
                    {count} gaps
                  </span>
                </button>
                {isOpen && (
                  <>
                    {groupLoading[c.name] ? (
                      <div className="flex items-center justify-center py-8 text-[#667085]">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading…
                      </div>
                    ) : (
                      <>
                        <OpportunityTable rows={rows} totalCompetitors={competitors.length} onSelect={onSelect} />
                        <Pagination
                          page={gPage}
                          totalPages={gTotalPages}
                          totalItems={groupTotals[c.name] ?? count}
                          pageSize={pageSize}
                          onPageChange={(p) => setGroupPages((gp) => ({ ...gp, [c.name]: p }))}
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

export type { EnrichedOpportunity };
