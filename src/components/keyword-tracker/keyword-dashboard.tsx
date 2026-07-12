"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Columns3,
  ExternalLink,
  Loader2,
  Medal,
  MoreHorizontal,
  Play,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Target,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import { KeywordBestOpportunityPanel } from "@/components/keyword-tracker/keyword-best-opportunity-panel";
import {
  KeywordsKpiCard,
  KeywordsMarketBanner,
  KeywordsPageHeader,
  KeywordsPanel,
  VisibilityBar,
} from "@/components/keyword-tracker/keyword-tracker-ui";
import {
  formatTimeAgo,
  formatVolume,
  rankBadgeClass,
  type RankBucket,
} from "@/lib/keyword-tracker/visibility";
import { cn } from "@/lib/utils";
import { ModulePage } from "@/components/ui/design-system";

type RankCheck = {
  rank: number | null;
  rank_bucket: string;
  visibility_score: number;
  checked_at: string;
};

type KeywordRow = {
  id: string;
  keyword: string;
  location_name: string | null;
  search_volume: number | null;
  tracking_frequency: string;
  active: boolean;
  latest_check: RankCheck | null;
  rank_change: number | null;
  opportunity: number;
  recent_checks: RankCheck[];
};

type Suggestion = {
  id: string;
  keyword: string;
  search_volume: number | null;
  intent_type: string;
  priority: string;
  reason: string | null;
};

type VolumeMarket = {
  city: string | null;
  state: string | null;
  label: string;
  display: string;
  location_code: number | null;
  level: "city" | "state" | "country" | "missing";
  ready: boolean;
};

type TrackerData = {
  keywords: KeywordRow[];
  suggestions: Suggestion[];
  summary: {
    tracked_count: number;
    avg_rank: number | null;
    top3_count: number;
    best_opportunity: { keyword: string; score: number; keyword_id?: string } | null;
    avg_rank_delta: number | null;
    top3_delta: number | null;
  };
  market: VolumeMarket;
  business: {
    name: string;
    lat: number | null;
    lng: number | null;
  };
};

const PAGE_SIZE = 10;

function RankBadge({ rank, bucket }: { rank: number | null; bucket: string }) {
  const label = rank != null && rank > 0 ? String(rank) : "20+";
  return (
    <span
      className={`inline-flex min-w-[2rem] justify-center rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${rankBadgeClass(bucket as RankBucket)}`}
    >
      {label}
    </span>
  );
}

function ChangeCell({ change }: { change: number | null }) {
  if (change == null || change === 0) return <span className="text-xs text-text-muted">—</span>;
  const up = change > 0;
  return (
    <span className={cn("text-xs font-medium tabular-nums", up ? "text-primary" : "text-red-600")}>
      {up ? "↑" : "↓"} {Math.abs(change)}
    </span>
  );
}

function rankMatchesFilter(rank: number | null | undefined, filter: string): boolean {
  if (filter === "all") return true;
  const r = rank ?? 99;
  if (filter === "top3") return r <= 3;
  if (filter === "top10") return r <= 10;
  if (filter === "top20") return r <= 20;
  if (filter === "beyond") return r > 20 || rank == null || rank <= 0;
  return true;
}

export function KeywordTrackerDashboard({ businessId }: { businessId: string }) {
  const [data, setData] = useState<TrackerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("all");
  const [rankFilter, setRankFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [addForm, setAddForm] = useState({
    keyword: "",
    locationName: "",
    trackingFrequency: "weekly" as "daily" | "weekly",
    fetchVolume: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/keywords/${businessId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setData(json);
      if (json.market?.ready && json.market.display) {
        setAddForm((f) => (f.locationName ? f : { ...f, locationName: json.market.display }));
      }
      if (json.summary?.best_opportunity?.keyword_id) {
        setSelectedId((prev) => prev ?? json.summary.best_opportunity.keyword_id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runAction(action: string, fn: () => Promise<void>) {
    setBusy(action);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    await runAction("add", async () => {
      const res = await fetch("/api/keywords/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          keyword: addForm.keyword,
          locationName: addForm.locationName || undefined,
          trackingFrequency: addForm.trackingFrequency,
          fetchVolume: addForm.fetchVolume,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to add");
      setShowAdd(false);
      setAddForm((f) => ({ ...f, keyword: "" }));
    });
  }

  const summary = data?.summary;
  const keywords = (data?.keywords ?? []).filter((k) => k.active);
  const market = data?.market;
  const marketReady = market?.ready ?? false;

  const locations = useMemo(() => {
    const set = new Set<string>();
    for (const k of keywords) {
      if (k.location_name) set.add(k.location_name);
    }
    return Array.from(set).sort();
  }, [keywords]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return keywords.filter((k) => {
      if (q && !k.keyword.toLowerCase().includes(q)) return false;
      if (locationFilter !== "all" && k.location_name !== locationFilter) return false;
      if (!rankMatchesFilter(k.latest_check?.rank, rankFilter)) return false;
      return true;
    });
  }, [keywords, search, locationFilter, rankFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const paged = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, locationFilter, rankFilter]);

  const selectedKeyword =
    keywords.find((k) => k.id === selectedId) ??
    keywords.find((k) => k.id === summary?.best_opportunity?.keyword_id) ??
    [...keywords].sort((a, b) => b.opportunity - a.opportunity)[0] ??
    null;

  const trackedSpark = keywords.map((k) => k.latest_check?.visibility_score ?? 0);
  const rankSpark = keywords.map((k) => {
    const r = k.latest_check?.rank;
    return r != null && r > 0 ? 21 - Math.min(r, 20) : 0;
  });
  const top3Spark = keywords.map((k) => {
    const r = k.latest_check?.rank;
    return r != null && r > 0 && r <= 3 ? 1 : 0;
  });

  function formatLocation(name: string | null): string {
    let loc = name ?? market?.display ?? "";
    if (!loc) return "—";
    loc = loc.replace(/,\s*/g, ", ");
    if (!loc.toLowerCase().includes("united states")) {
      loc = `${loc}, United States`;
    }
    return loc;
  }

  const avgRankDisplay =
    summary?.avg_rank != null
      ? Number.isInteger(summary.avg_rank)
        ? summary.avg_rank
        : summary.avg_rank.toFixed(1)
      : "—";

  return (
    <ModulePage>
      <KeywordsPageHeader businessId={businessId} />

      {market && <KeywordsMarketBanner ready={marketReady} display={market.display} />}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          disabled={!!busy}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Add Keyword
        </button>
        <button
          type="button"
          disabled={!!busy || !keywords.length}
          onClick={() =>
            runAction("check", async () => {
              const res = await fetch("/api/keywords/check", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ businessId }),
              });
              const json = await res.json();
              if (!res.ok) throw new Error(json.error ?? "Check failed");
            })
          }
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
        >
          {busy === "check" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Run Keyword Check
        </button>
        <button
          type="button"
          disabled={!!busy || !keywords.length || !marketReady}
          onClick={() =>
            runAction("volume", async () => {
              const res = await fetch("/api/keywords/volume", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ businessId }),
              });
              const json = await res.json();
              if (!res.ok) throw new Error(json.error ?? "Volume refresh failed");
            })
          }
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
        >
          {busy === "volume" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh Volumes
        </button>
        <button
          type="button"
          disabled={!!busy || !marketReady}
          onClick={() =>
            runAction("suggest", async () => {
              const res = await fetch("/api/keywords/suggest", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ businessId }),
              });
              const json = await res.json();
              if (!res.ok) throw new Error(json.error ?? "Suggest failed");
              setShowSuggest(true);
            })
          }
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
        >
          {busy === "suggest" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Suggest Keywords
        </button>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="ml-auto inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KeywordsKpiCard
          label="Tracked Keywords"
          value={summary?.tracked_count ?? 0}
          sub="Keywords you're tracking."
          icon={BarChart3}
          sparkPoints={trackedSpark}
        />
        <KeywordsKpiCard
          label="Avg Rank"
          value={avgRankDisplay}
          icon={Medal}
          trend={summary?.avg_rank_delta}
          trendLabel="vs last 30 days"
          invertTrend
          sparkPoints={rankSpark}
        />
        <KeywordsKpiCard
          label="Top 3 Keywords"
          value={summary?.top3_count ?? 0}
          icon={Target}
          trend={summary?.top3_delta}
          trendLabel="vs last 30 days"
          sparkPoints={top3Spark}
        />
        <button
          type="button"
          onClick={() => selectedKeyword && setSelectedId(selectedKeyword.id)}
          className="w-full text-left"
        >
          <KeywordsKpiCard
            label="Best Opportunity"
            value={summary?.best_opportunity?.keyword ?? "—"}
            sub={summary?.best_opportunity ? `Score ${Math.min(100, summary.best_opportunity.score)}` : undefined}
            icon={Trophy}
            showChevron
            isKeywordValue
          />
          <span className="sr-only">View best opportunity</span>
        </button>
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center py-12 text-text-muted">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading keywords…
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
          <KeywordsPanel className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-4 py-3">
              <div className="relative min-w-[200px] flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search keywords..."
                  className="w-full rounded-lg border border-zinc-200 py-2 pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700"
              >
                <option value="all">All Locations</option>
                {locations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
              <select
                value={rankFilter}
                onChange={(e) => setRankFilter(e.target.value)}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700"
              >
                <option value="all">All Ranks</option>
                <option value="top3">Top 3</option>
                <option value="top10">Top 10</option>
                <option value="top20">Top 20</option>
                <option value="beyond">20+</option>
              </select>
              <select className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700" defaultValue="all">
                <option value="all">All Tags</option>
              </select>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
              >
                <Columns3 className="h-3.5 w-3.5" />
                Columns
              </button>
            </div>

            {!keywords.length ? (
              <div className="p-10 text-center text-sm text-text-muted">
                No keywords tracked yet. Add keywords or use Suggest Keywords to get started.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="border-b border-zinc-100 bg-zinc-50/80">
                      <tr>
                        <th className="w-8 px-4 py-3" />
                        <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                          Keyword
                        </th>
                        <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                          Location
                        </th>
                        <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                          Search Volume
                        </th>
                        <th className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                          Rank
                        </th>
                        <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                          Visibility
                        </th>
                        <th className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                          Change
                        </th>
                        <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                          Updated
                        </th>
                        <th className="w-10 px-3 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {paged.map((k) => (
                        <tr
                          key={k.id}
                          onClick={() => setSelectedId(k.id)}
                          className={cn(
                            "cursor-pointer hover:bg-surface-subtle/80",
                            selectedId === k.id && "bg-emerald-50/40"
                          )}
                        >
                          <td className="px-3 py-3">
                            <Star className="h-4 w-4 text-zinc-300" />
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-zinc-900">{k.keyword}</span>
                              <ExternalLink className="h-3 w-3 text-zinc-400" />
                            </div>
                          </td>
                          <td className="px-3 py-3 text-xs text-zinc-500">{formatLocation(k.location_name)}</td>
                          <td className="px-3 py-3 text-right tabular-nums text-text-muted">{formatVolume(k.search_volume)}</td>
                          <td className="px-3 py-3 text-center">
                            <RankBadge rank={k.latest_check?.rank ?? null} bucket={k.latest_check?.rank_bucket ?? "beyond"} />
                          </td>
                          <td className="px-3 py-3">
                            <VisibilityBar score={k.latest_check?.visibility_score} />
                          </td>
                          <td className="px-3 py-3 text-center">
                            <ChangeCell change={k.rank_change} />
                          </td>
                          <td className="px-3 py-3 text-right text-xs text-text-muted">
                            {formatTimeAgo(k.latest_check?.checked_at)}
                          </td>
                          <td className="relative px-3 py-3 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuOpen(menuOpen === k.id ? null : k.id);
                              }}
                              className="rounded p-1 text-text-muted hover:bg-surface-subtle hover:text-text-muted"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                            {menuOpen === k.id && (
                              <div className="absolute right-3 top-10 z-10 w-36 rounded-md border border-border bg-white py-1 shadow-lg">
                                <button
                                  type="button"
                                  disabled={!!busy}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMenuOpen(null);
                                    void runAction("remove", async () => {
                                      const res = await fetch("/api/keywords/remove", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ businessId, keywordId: k.id }),
                                      });
                                      if (!res.ok) {
                                        const json = await res.json();
                                        throw new Error(json.error);
                                      }
                                    });
                                  }}
                                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Remove
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-3 text-xs text-zinc-500">
                  <span>
                    Showing {(pageSafe - 1) * PAGE_SIZE + 1} to {Math.min(pageSafe * PAGE_SIZE, filtered.length)} of{" "}
                    {filtered.length} keywords
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPage(Math.max(1, pageSafe - 1))}
                      disabled={pageSafe <= 1}
                      className="flex h-7 w-7 items-center justify-center rounded border border-zinc-200 text-zinc-500 hover:bg-zinc-50 disabled:opacity-40"
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPage(p)}
                        className={cn(
                          "flex h-7 min-w-7 items-center justify-center rounded border px-1 text-xs font-medium",
                          p === pageSafe
                            ? "border-emerald-600 text-emerald-700"
                            : "border-transparent text-zinc-500 hover:bg-zinc-50"
                        )}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setPage(Math.min(totalPages, pageSafe + 1))}
                      disabled={pageSafe >= totalPages}
                      className="flex h-7 w-7 items-center justify-center rounded border border-zinc-200 text-zinc-500 hover:bg-zinc-50 disabled:opacity-40"
                      aria-label="Next page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </KeywordsPanel>

          <div className="space-y-3">
            <KeywordBestOpportunityPanel
              keyword={
                selectedKeyword
                  ? {
                      id: selectedKeyword.id,
                      keyword: selectedKeyword.keyword,
                      opportunity: selectedKeyword.opportunity,
                      search_volume: selectedKeyword.search_volume,
                      latest_check: selectedKeyword.latest_check,
                      recent_checks: selectedKeyword.recent_checks,
                    }
                  : null
              }
            />
          </div>
        </div>
      )}

      {showAdd && (
        <Modal title="Add Keyword" onClose={() => setShowAdd(false)}>
          <form onSubmit={handleAdd} className="space-y-4">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-text">Keyword</span>
              <input
                required
                value={addForm.keyword}
                onChange={(e) => setAddForm((f) => ({ ...f, keyword: e.target.value }))}
                placeholder="junk removal Woodbridge"
                className="w-full rounded-lg border border-border px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-text">City, state (volume market)</span>
              <input
                value={addForm.locationName}
                onChange={(e) => setAddForm((f) => ({ ...f, locationName: e.target.value }))}
                placeholder="Woodbridge, VA"
                required
                className="w-full rounded-lg border border-border px-3 py-2"
              />
              <span className="mt-1 block text-xs text-text-muted">
                Google Ads city + state only. Defaults from your business profile.
              </span>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-text">Tracking frequency</span>
              <select
                value={addForm.trackingFrequency}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, trackingFrequency: e.target.value as "daily" | "weekly" }))
                }
                className="w-full rounded-lg border border-border px-3 py-2"
              >
                <option value="weekly">Weekly</option>
                <option value="daily">Daily</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={addForm.fetchVolume}
                onChange={(e) => setAddForm((f) => ({ ...f, fetchVolume: e.target.checked }))}
              />
              Fetch search volume
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowAdd(false)} className="rounded-lg border px-4 py-2 text-sm">
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy === "add"}
                className="rounded-lg bg-[#16A34A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#15803D] disabled:opacity-50"
              >
                {busy === "add" ? "Adding…" : "Add Keyword"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showSuggest && data?.suggestions?.length ? (
        <Modal title="Suggested Keywords" onClose={() => setShowSuggest(false)}>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {data.suggestions.map((s) => (
              <div key={s.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
                <div>
                  <p className="font-medium">{s.keyword}</p>
                  <p className="text-xs text-text-muted">
                    {s.intent_type.replace(/_/g, " ")} · {formatVolume(s.search_volume)} · {s.priority}
                  </p>
                  {s.reason && <p className="mt-1 text-xs text-text-muted">{s.reason}</p>}
                </div>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() =>
                    runAction("add-suggest", async () => {
                      const res = await fetch("/api/keywords/add", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ businessId, keyword: s.keyword, fetchVolume: false, suggestionId: s.id }),
                      });
                      if (!res.ok) {
                        const json = await res.json();
                        throw new Error(json.error);
                      }
                    })
                  }
                  className="shrink-0 rounded-lg bg-[#16A34A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#15803D]"
                >
                  Track
                </button>
              </div>
            ))}
          </div>
        </Modal>
      ) : null}
    </ModulePage>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-surface-subtle">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}
