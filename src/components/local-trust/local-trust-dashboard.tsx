"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { LocalTrustCompetitorsTab } from "@/components/local-trust/local-trust-competitors-tab";
import { LocalTrustHistoryTab, type RunHistoryRow } from "@/components/local-trust/local-trust-history-tab";
import { LocalTrustMarketBar } from "@/components/local-trust/local-trust-market-bar";
import { LocalTrustOpportunitiesPanel } from "@/components/local-trust/local-trust-opportunities-panel";
import { LocalTrustOverviewTab } from "@/components/local-trust/local-trust-overview-tab";
import { LocalTrustQueriesTab } from "@/components/local-trust/local-trust-queries-tab";
import { LocalTrustTasksTab } from "@/components/local-trust/local-trust-tasks-tab";
import {
  LocalTrustTabId,
  TrustActionBar,
  TrustFooter,
  TrustKpiRow,
  TrustMetaLine,
  TrustPageHeader,
  TrustTabs,
  TrustTopBar,
} from "@/components/local-trust/local-trust-ui";
import { ModulePage, AlertBanner, EmptyState } from "@/components/ui/design-system";
import { dashboardCard } from "@/components/overview/dashboard-ui";
import { cn } from "@/lib/utils";

type RunData = {
  run: {
    id: string;
    status: string;
    city: string | null;
    county: string | null;
    state: string | null;
    keyword: string | null;
    scan_type?: string;
    opportunities_found: number;
    high_priority_count: number;
    local_relevance_score: number | null;
    easy_wins_count: number;
    ai_summary: string | null;
    progress_stage: string | null;
    error_message: string | null;
    created_at: string;
    filtered_out_count?: number;
    rescan_summary_json?: Record<string, unknown> | null;
  } | null;
  opportunities: Array<Record<string, unknown>>;
  tasks: Array<Record<string, unknown>>;
  searchQueries: string[];
  aiJson: Record<string, unknown> | null;
  marketTotal?: number;
};

type MarketSelection = { city: string; state: string } | "all";

function marketQuery(selection: MarketSelection) {
  if (selection === "all") return "allMarkets=true";
  return `marketCity=${encodeURIComponent(selection.city)}&marketState=${encodeURIComponent(selection.state)}`;
}

type MarketRecord = {
  city: string;
  state: string;
  county: string | null;
  acceptedCount: number;
  rejectedCount: number;
  latestRunAt: string | null;
};

export function LocalTrustDashboard({ businessId }: { businessId: string }) {
  const [data, setData] = useState<RunData | null>(null);
  const [markets, setMarkets] = useState<MarketRecord[]>([]);
  const [runs, setRuns] = useState<RunHistoryRow[]>([]);
  const [suggestions, setSuggestions] = useState<Array<{ city: string; state: string }>>([]);
  const [selectedMarket, setSelectedMarket] = useState<MarketSelection>("all");
  const [tab, setTab] = useState<LocalTrustTabId>("overview");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uniqueDomains, setUniqueDomains] = useState(0);
  const [lastRescanSummary, setLastRescanSummary] = useState<Record<string, unknown> | null>(null);

  const activeCity = selectedMarket === "all" ? data?.run?.city : selectedMarket.city;
  const activeState = selectedMarket === "all" ? data?.run?.state : selectedMarket.state;

  const loadMarkets = useCallback(async () => {
    const qs =
      activeCity && activeState
        ? `?city=${encodeURIComponent(activeCity)}&state=${encodeURIComponent(activeState)}`
        : "";
    const [marketsRes, runsRes] = await Promise.all([
      fetch(`/api/trust/${businessId}/markets${qs}`),
      fetch(`/api/trust/${businessId}/markets?view=runs`),
    ]);
    const marketsJson = await marketsRes.json();
    const runsJson = await runsRes.json();
    if (marketsRes.ok) {
      const list = (marketsJson.markets ?? []).map(
        (m: {
          city: string;
          state: string;
          county: string | null;
          acceptedCount: number;
          rejectedCount: number;
          latestRunAt: string | null;
        }) => ({
          city: m.city,
          state: m.state,
          county: m.county,
          acceptedCount: m.acceptedCount,
          rejectedCount: m.rejectedCount,
          latestRunAt: m.latestRunAt,
        })
      );
      setMarkets(list);
      setSuggestions(marketsJson.suggestions ?? []);
    }
    if (runsRes.ok) setRuns(runsJson.runs ?? []);
  }, [businessId, activeCity, activeState]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const mq = marketQuery(selectedMarket);
      const res = await fetch(`/api/trust/${businessId}?${mq}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setData(json);

      const oppsRes = await fetch(`/api/trust/${businessId}/opportunities?pageSize=100&${mq}`);
      const oppsJson = await oppsRes.json();
      if (oppsRes.ok) {
        const domains = new Set(
          ((oppsJson.items ?? []) as Array<{ domain?: string }>).map((o) => o.domain).filter(Boolean)
        );
        setUniqueDomains(domains.size);
      }

      await loadMarkets();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [businessId, selectedMarket, loadMarkets]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (data?.run?.status !== "running") return;
    const id = setInterval(() => void load(), 4000);
    return () => clearInterval(id);
  }, [data?.run?.status, load]);

  async function runScan(input: {
    city?: string;
    state?: string;
    county?: string;
    rescan?: boolean;
  }) {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/trust/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          city: input.city,
          state: input.state,
          county: input.county,
          rescan: input.rescan,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Finder failed");
      if (json.rescanSummary) setLastRescanSummary(json.rescanSummary as Record<string, unknown>);
      if (input.city && input.state) {
        setSelectedMarket({ city: input.city, state: input.state });
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Finder failed");
    } finally {
      setRunning(false);
    }
  }

  const run = data?.run;
  const isRunning = run?.status === "running" || running;
  const quickWins = (data?.aiJson?.quick_wins as string[] | undefined) ?? [];
  const rejectedOpportunities =
    (data?.aiJson?.rejected_opportunities as Array<Record<string, unknown>> | undefined) ?? [];

  const marketTotal = data?.marketTotal ?? run?.opportunities_found ?? 0;
  const combinedTotal = useMemo(
    () => markets.reduce((sum, m) => sum + m.acceptedCount, 0),
    [markets]
  );
  const displayOpportunityCount =
    selectedMarket === "all"
      ? combinedTotal || run?.opportunities_found || 0
      : marketTotal || run?.opportunities_found || 0;

  const footerMessage =
    tab === "queries"
      ? "Query data is AI-generated and refreshed on a regular basis. Next refresh scheduled for tomorrow."
      : "Opportunity data is refreshed on a regular basis. Each market scan is saved separately.";

  const rescanSummary =
    lastRescanSummary ??
    (run?.rescan_summary_json as Record<string, unknown> | undefined) ??
    (data?.aiJson?.rescan_summary as Record<string, unknown> | undefined);

  return (
    <ModulePage>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <TrustPageHeader />
        <TrustTopBar />
      </div>

      <div className="space-y-2.5">
        {(markets.length > 0 || run) && (
          <LocalTrustMarketBar
            markets={markets.map((m) => ({
              city: m.city,
              state: m.state,
              county: m.county,
              acceptedCount: m.acceptedCount,
            }))}
            selected={selectedMarket}
            onSelect={setSelectedMarket}
            onSearchNewMarket={(input) => void runScan({ ...input, rescan: false })}
            suggestions={suggestions}
            disabled={isRunning}
          />
        )}

        {run && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TrustMetaLine
              city={activeCity}
              state={activeState}
              county={run.county}
              createdAt={run.created_at}
            />
            <TrustActionBar
              isRunning={isRunning}
              loading={loading}
              onRefresh={() => void load()}
              onRun={() => void runScan({})}
              hideRun={markets.length > 0}
              showRescan={selectedMarket !== "all"}
              onRescan={() =>
                selectedMarket !== "all" &&
                void runScan({
                  city: selectedMarket.city,
                  state: selectedMarket.state,
                  rescan: true,
                })
              }
            />
          </div>
        )}
        {!run && (
          <div className="flex justify-end">
            <TrustActionBar
              isRunning={isRunning}
              loading={loading}
              onRefresh={() => void load()}
              onRun={() => void runScan({})}
            />
          </div>
        )}
      </div>

      {error && <AlertBanner variant="error">{error}</AlertBanner>}

      {run?.progress_stage && isRunning && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2 text-[13px] text-amber-900">
          <Loader2 className="mr-1.5 inline h-3.5 w-3.5 animate-spin" />
          {run.progress_stage}…
        </div>
      )}

      {rescanSummary && run?.scan_type === "rescan" && !isRunning && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-[13px] text-emerald-900">
          <p className="font-semibold">Scan summary — {run.city}, {run.state}</p>
          <p className="mt-0.5 text-[11px]">
            {Number(rescanSummary.candidatesFound ?? 0)} candidates found ·{" "}
            {Number(rescanSummary.alreadyKnown ?? 0)} already known ·{" "}
            {Number(rescanSummary.previouslyRejected ?? 0)} auto-skipped from rejection history ·{" "}
            {Number(rescanSummary.newCandidatesChecked ?? 0)} new pages verified ·{" "}
            {Number(rescanSummary.newOpportunitiesAdded ?? 0)} new opportunities added ·{" "}
            {Number(rescanSummary.marketTotalAccepted ?? 0)} total in market
          </p>
        </div>
      )}

      {loading && !run && (
        <div className="flex items-center justify-center py-10 text-zinc-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading local trust data…
        </div>
      )}

      {!loading && !run && (
        <EmptyState
          title="No local trust scan yet"
          description="Run the finder for your primary city to discover sponsorship and community opportunities."
        />
      )}

      {run && (
        <>
          {tab !== "queries" && (
            <TrustKpiRow
              opportunitiesFound={displayOpportunityCount}
              highPriority={run.high_priority_count}
              relevanceScore={run.local_relevance_score ?? "—"}
              easyWins={run.easy_wins_count}
            />
          )}

          <TrustTabs active={tab} onChange={setTab} />

          {tab === "overview" && (
            <LocalTrustOverviewTab
              businessId={businessId}
              aiSummary={run.ai_summary}
              quickWins={quickWins}
              opportunitiesFound={displayOpportunityCount}
              easyWins={run.easy_wins_count}
              onViewOpportunities={() => setTab("opportunities")}
              marketQuery={marketQuery(selectedMarket)}
            />
          )}

          {tab === "opportunities" && (
            <LocalTrustOpportunitiesPanel
              businessId={businessId}
              easyWins={run.easy_wins_count}
              totalOpportunities={displayOpportunityCount}
              marketCity={selectedMarket === "all" ? null : selectedMarket.city}
              marketState={selectedMarket === "all" ? null : selectedMarket.state}
              allMarkets={selectedMarket === "all"}
            />
          )}

          {tab === "history" && (
            <LocalTrustHistoryTab
              runs={runs}
              markets={markets}
              onViewRun={(r) => {
                if (r.city && r.state) {
                  setSelectedMarket({ city: r.city, state: r.state });
                  setTab("opportunities");
                }
              }}
              onRescan={(city, state) => void runScan({ city, state, rescan: true })}
              isRunning={isRunning}
            />
          )}

          {tab === "rejected" && <TrustRejectedTab items={rejectedOpportunities} />}

          {tab === "queries" && (
            <LocalTrustQueriesTab
              searchQueries={data?.searchQueries ?? []}
              opportunitiesFound={displayOpportunityCount}
              localRelevanceScore={run.local_relevance_score}
              createdAt={run.created_at}
              uniqueDomains={uniqueDomains}
            />
          )}

          {tab === "competitors" && (
            <LocalTrustCompetitorsTab
              businessId={businessId}
              marketCity={selectedMarket === "all" ? null : selectedMarket.city}
              marketState={selectedMarket === "all" ? null : selectedMarket.state}
              allMarkets={selectedMarket === "all"}
            />
          )}

          {tab === "tasks" && <LocalTrustTasksTab tasks={data?.tasks ?? []} />}

          <TrustFooter message={footerMessage} />
        </>
      )}
    </ModulePage>
  );
}

function TrustRejectedTab({ items }: { items: Array<Record<string, unknown>> }) {
  if (!items.length) {
    return (
      <div className={cn(dashboardCard, "px-3.5 py-8 text-center")}>
        <p className="text-[13px] text-zinc-500">No rejected candidates recorded for this run.</p>
      </div>
    );
  }

  const stageLabel = (stage: string) => {
    if (stage === "snippet_filter") return "Snippet filter";
    if (stage === "page_fetch") return "Page fetch";
    if (stage === "page_verify") return "Page verification";
    return stage;
  };

  return (
    <div className={cn(dashboardCard, "overflow-hidden")}>
      <div className="border-b border-zinc-100 px-3.5 py-2 text-[12px] text-zinc-500">
        {items.length} candidate{items.length === 1 ? "" : "s"} did not pass — reasons below.
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-[12px]">
          <thead className="bg-zinc-50 text-left text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3.5 py-2">Candidate</th>
              <th className="px-3.5 py-2">Stage</th>
              <th className="px-3.5 py-2">Why rejected</th>
              <th className="px-3.5 py-2">Scores</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {items.map((item) => (
              <tr key={String(item.url)} className="align-top hover:bg-zinc-50/80">
                <td className="px-3.5 py-2">
                  <a
                    href={String(item.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-emerald-700 hover:underline"
                  >
                    {String(item.title)}
                  </a>
                  <p className="mt-0.5 text-[11px] text-zinc-400">{String(item.domain ?? "")}</p>
                </td>
                <td className="px-3.5 py-2 text-[11px] text-zinc-500">{stageLabel(String(item.stage ?? ""))}</td>
                <td className="max-w-md px-3.5 py-2 text-[11px] leading-snug text-zinc-700">{String(item.reason ?? "—")}</td>
                <td className="px-3.5 py-2 text-[11px] tabular-nums text-zinc-500">
                  {item.confidence != null || item.localRelevance != null
                    ? `Conf ${item.confidence ?? "—"} · Local ${item.localRelevance ?? "—"}`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
