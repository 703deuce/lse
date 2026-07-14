"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { AiVisibilityDashboardTab } from "@/components/ai-visibility/ai-visibility-dashboard-tab";
import { AiVisibilityEvidenceTab } from "@/components/ai-visibility/ai-visibility-evidence-tab";
import { AiVisibilityMentionsTab } from "@/components/ai-visibility/ai-visibility-mentions-tab";
import { AiVisibilityRunHistoryTab } from "@/components/ai-visibility/ai-visibility-run-history-tab";
import { AiVisibilitySearchLandscapeTab } from "@/components/ai-visibility/ai-visibility-search-landscape-tab";
import type { AiVisibilityTabId, RunView, VisibilityData } from "@/components/ai-visibility/ai-visibility-types";
import {
  AiKpiCard,
  AiVisibilityFooter,
  AiVisibilityHeaderRow,
  AiVisibilitySearchBar,
  AiVisibilityTabFilters,
  AiVisibilityTabs,
  AiVisibilityViewControls,
  BarChart3,
  Building2,
  Calendar,
  EngineIconRow,
  PieChart,
  Sparkles,
  TrendingUp,
  Users,
} from "@/components/ai-visibility/ai-visibility-ui";
import { ModulePage } from "@/components/ui/design-system";
import { KpiRow } from "@/components/ui/metric-card";
import type { RunSummary } from "@/lib/ai-visibility/types";

function formatRunLabel(r: RunSummary) {
  const d = new Date(r.created_at);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function visibilityDelta(trend: VisibilityData["visibilityTrend"]): string | undefined {
  if (trend.length < 2) return undefined;
  const latest = trend[0]?.visibilityScore ?? 0;
  const prev = trend[1]?.visibilityScore ?? 0;
  const d = latest - prev;
  if (d === 0) return undefined;
  return `${d > 0 ? "▲" : "▼"} ${Math.abs(d)} pts`;
}

export function AiVisibilityDashboard({ businessId }: { businessId: string }) {
  const [data, setData] = useState<VisibilityData | null>(null);
  const [tab, setTab] = useState<AiVisibilityTabId>("dashboard");
  const [runView, setRunView] = useState<RunView | "pending">("pending");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [mentionsMode, setMentionsMode] = useState<"current" | "across" | "by-engine">("current");

  const effectiveRunView: RunView = runView === "pending" ? "combined" : runView;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const runParam = effectiveRunView === "combined" ? "combined" : effectiveRunView;
      const res = await fetch(`/api/ai-visibility/${businessId}?runId=${encodeURIComponent(runParam)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");

      if (runView === "pending") {
        const latest = (json.runs as RunSummary[] | undefined)?.find((r) => r.status === "complete");
        // Always leave pending after first settle — empty/failed history still renders the empty CTA.
        setRunView(latest?.id ?? "combined");
      }

      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
      if (runView === "pending") setRunView("combined");
    } finally {
      setLoading(false);
    }
  }, [businessId, effectiveRunView, runView]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (data?.runningRun?.status !== "running" && data?.latestRun?.status !== "running") return;
    const id = setInterval(() => void load(), 4000);
    return () => clearInterval(id);
  }, [data?.latestRun?.status, data?.runningRun?.status, load]);

  const isCombined = effectiveRunView === "combined";
  const run = data?.latestRun;
  const activeRun = data?.runningRun ?? run;
  const isRunning = activeRun?.status === "running" || running;
  const aggregate = data?.aggregateMetrics;
  const leaderboard = isCombined ? [] : (data?.mentionLeaderboard ?? []);
  const historicalMentions = data?.historicalMentions ?? [];
  const targetRow = isCombined
    ? historicalMentions.find((r) => r.isTargetBrand)
    : leaderboard.find((r) => r.isTargetBrand);

  const trendSpark = useMemo(
    () => (data?.visibilityTrend ?? []).map((p) => p.visibilityScore ?? 0),
    [data?.visibilityTrend]
  );

  const visDelta = visibilityDelta(data?.visibilityTrend ?? []);
  const completeRuns = (data?.runs ?? []).filter((r) => r.status === "complete");
  const mentionedRuns = completeRuns.filter((r) => r.target_mentioned).length;
  const avgCompanies =
    completeRuns.length > 0
      ? Math.round(completeRuns.reduce((a, r) => a + r.companyCount, 0) / completeRuns.length)
      : 0;

  const uniqueDomains = useMemo(() => {
    const domains = new Set<string>();
    for (const s of data?.allSources ?? []) {
      if (s.url) {
        try {
          domains.add(new URL(s.url).hostname);
        } catch {
          /* skip */
        }
      }
    }
    return domains.size;
  }, [data?.allSources]);

  function selectRun(view: RunView) {
    setRunView(view);
    setSearch("");
  }

  async function runCheck() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/ai-visibility/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, maxPrompts: 1 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Check failed");
      setRunView("combined");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check failed");
    } finally {
      setRunning(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <ModulePage>
        <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-[13px] text-red-800">
          {error}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 text-[13px] font-medium text-emerald-700 hover:underline"
        >
          Try again
        </button>
      </ModulePage>
    );
  }

  if (!data) return null;

  const enginesMentioning = isCombined
    ? (aggregate?.enginesMentioningTarget ?? 0)
    : (leaderboard.find((r) => r.isTargetBrand)?.engineCount ?? 0);

  const visibilityScore = isCombined ? aggregate?.visibilityScore : run?.visibility_score;
  const targetEngines = leaderboard.find((r) => r.isTargetBrand)?.engines ?? [];

  return (
    <ModulePage>
      <AiVisibilityHeaderRow
        businessId={businessId}
        isRunning={isRunning}
        hasPrimary={!!data?.primaryPrompt}
        loading={loading}
        onRun={() => void runCheck()}
        onRefresh={() => void load()}
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-[13px] text-red-800">{error}</div>
      )}

      {activeRun?.progress_stage && isRunning && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2 text-[13px] text-amber-900">
          <Loader2 className="mr-2 inline h-3.5 w-3.5 animate-spin" />
          {activeRun.progress_stage}…
        </div>
      )}

      <AiVisibilityViewControls
        runView={effectiveRunView}
        runs={data?.runs ?? []}
        onRunViewChange={(view) => {
          selectRun(view);
          if (view === "combined") setMentionsMode("across");
          else setMentionsMode("current");
        }}
        formatRunLabel={formatRunLabel}
        variant={tab === "mentions" ? "mentions" : "default"}
        mentionsMode={mentionsMode}
        onMentionsModeChange={setMentionsMode}
      />

      {(tab === "dashboard" || tab === "landscape") && (
        <AiVisibilitySearchBar value={search} onChange={setSearch} />
      )}

      {tab === "dashboard" && (
        <KpiRow cols={6}>
          <AiKpiCard
            label="Visibility Score"
            value={visibilityScore ?? "—"}
            valueSuffix={visibilityScore != null ? "/ 100" : undefined}
            icon={Sparkles}
            sparkPoints={trendSpark}
            trend={visDelta}
            trendLabel="vs last run"
          />
          <AiKpiCard
            label="Mention Share"
            value={
              targetRow
                ? `${targetRow.sharePct}%`
                : isCombined && aggregate?.mentionSharePct != null
                  ? `${aggregate.mentionSharePct}%`
                  : "—"
            }
            icon={BarChart3}
          />
          <AiKpiCard
            label="Engines Mentioning"
            value={`${enginesMentioning} / ${aggregate?.totalEngines ?? 5}`}
            icon={Sparkles}
          >
            <div className="mt-1">
              <EngineIconRow engines={targetEngines} />
            </div>
          </AiKpiCard>
          <AiKpiCard
            label="Companies Found"
            value={isCombined ? (aggregate?.totalCompaniesFound ?? "—") : leaderboard.length || "—"}
            icon={Building2}
          />
          <AiKpiCard
            label="Sources Cited"
            value={isCombined ? "—" : (run?.sources_count ?? "—")}
            icon={BarChart3}
          />
          <AiKpiCard
            label="Total Runs"
            value={aggregate?.completeRuns ?? "—"}
            sub="All time"
            icon={Calendar}
            iconClassName="bg-sky-50 text-sky-600"
          />
        </KpiRow>
      )}

      <AiVisibilityTabs tab={tab} onTabChange={setTab} />

      {tab === "history" && (
        <>
          <AiVisibilityTabFilters primaryPrompt={data?.primaryPrompt?.prompt_text} />
          <KpiRow cols={4}>
            <AiKpiCard
              label="Total Runs"
              value={aggregate?.completeRuns ?? "—"}
              sub="All time"
              icon={Calendar}
              iconClassName="bg-sky-50 text-sky-600"
            />
            <AiKpiCard
              label="Visibility Trend"
              value={visDelta ? visDelta.replace("pts", "%") : "+0%"}
              icon={TrendingUp}
              sparkPoints={trendSpark}
              trendLabel="vs prior run"
            />
            <AiKpiCard
              label="Mention Rate"
              value={
                completeRuns.length
                  ? `${Math.round((mentionedRuns / completeRuns.length) * 100)}%`
                  : "—"
              }
              sub={completeRuns.length ? `${mentionedRuns} / ${completeRuns.length} runs` : undefined}
              icon={PieChart}
              iconClassName="bg-violet-50 text-violet-600"
            />
            <AiKpiCard
              label="Avg. Companies"
              value={avgCompanies || "—"}
              sub="per run"
              icon={Users}
              iconClassName="bg-amber-50 text-amber-600"
            />
          </KpiRow>
        </>
      )}

      {tab === "dashboard" && (
        <AiVisibilityDashboardTab
          isCombined={isCombined}
          run={run ?? null}
          aggregate={aggregate}
          leaderboard={leaderboard}
          historicalMentions={historicalMentions}
          visibilityTrend={data?.visibilityTrend ?? []}
          engineResults={data?.engineResults ?? []}
          aiSummary={run?.ai_summary}
          totalEngines={aggregate?.totalEngines ?? 5}
          completeRuns={aggregate?.completeRuns ?? 0}
        />
      )}

      {tab === "mentions" && (
        <AiVisibilityMentionsTab
          isCombined={isCombined}
          leaderboard={leaderboard}
          historicalMentions={historicalMentions}
          recentRunCount={data?.recentRunCount ?? 0}
          search={search}
          aggregate={aggregate}
          targetRow={targetRow}
          trendSpark={trendSpark}
          enginesMentioning={enginesMentioning}
          targetEngines={targetEngines}
          mentionsMode={mentionsMode}
        />
      )}

      {tab === "landscape" && (
        <AiVisibilitySearchLandscapeTab
          keyword={data?.serpKeyword ?? data?.business.primaryKeyword ?? ""}
          businessName={data?.business.name ?? ""}
          searchLocation={
            data?.business.city && data?.business.state ? `${data.business.city}, ${data.business.state}` : null
          }
          mapPack={data?.mapPack ?? []}
          organicSerp={data?.organicSerp ?? []}
          serpMatches={data?.serpMatches ?? []}
        />
      )}

      {tab === "evidence" && (
        <AiVisibilityEvidenceTab
          sources={data?.allSources ?? []}
          fanouts={data?.allFanouts ?? []}
          isCombined={isCombined}
          uniqueDomains={uniqueDomains}
          trendSpark={trendSpark}
        />
      )}

      {tab === "history" && (
        <AiVisibilityRunHistoryTab
          runs={data?.runs ?? []}
          visibilityTrend={data?.visibilityTrend ?? []}
          engineResults={data?.engineResults ?? []}
          onSelectRun={(id) => {
            selectRun(id);
            setTab("dashboard");
          }}
        />
      )}

      <AiVisibilityFooter lastUpdated={run?.finished_at ?? aggregate?.lastRunAt} />
    </ModulePage>
  );
}
