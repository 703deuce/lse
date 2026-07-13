"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, X, ExternalLink } from "lucide-react";
import { OpportunitiesPanel, type EnrichedOpportunity } from "@/components/backlink-gap/opportunities-panel";
import { enrichOpportunities } from "@/lib/backlink-gap/enrich";
import type { BusinessContext } from "@/lib/backlink-gap/enrich";
import type { RawOpportunity } from "@/lib/backlink-gap/enrich";
import {
  BacklinkGapTabId,
  GapActionBar,
  GapIgnoredKpiRow,
  GapKpiRow,
  GapPageFooter,
  GapPageHeader,
  GapTabs,
  GapTargetLine,
  GapTopBar,
  priorityBadge,
} from "@/components/backlink-gap/backlink-gap-ui";
import { ModulePage, AlertBanner } from "@/components/ui/design-system";
import { BacklinkGapOverviewTab } from "@/components/backlink-gap/backlink-gap-overview-tab";
import { BacklinkGapMatrixTab } from "@/components/backlink-gap/backlink-gap-matrix-tab";
import { BacklinkGapTasksTab } from "@/components/backlink-gap/backlink-gap-tasks-tab";

type GapData = {
  run: {
    id: string;
    status: string;
    target_domain: string;
    target_ref_domain_count: number;
    competitor_ref_domain_count: number;
    missing_opportunity_count: number;
    high_priority_count: number;
    ai_summary: string | null;
    progress_stage: string | null;
    error_message: string | null;
    selected_competitors: Array<{ name: string; domain: string | null }>;
    created_at: string;
  } | null;
  tasks: Array<Record<string, unknown>>;
  competitors: Array<{ name: string; domain?: string | null }>;
  context?: BusinessContext;
};

type IgnoredStats = {
  ignored: number;
  spam: number;
  restored: number;
  review: number;
};

export function BacklinkGapDashboard({ businessId }: { businessId: string }) {
  const [data, setData] = useState<GapData | null>(null);
  const [tab, setTab] = useState<BacklinkGapTabId>("overview");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<EnrichedOpportunity | null>(null);
  const [updating, setUpdating] = useState(false);
  const [topOpportunities, setTopOpportunities] = useState<EnrichedOpportunity[]>([]);
  const [ignoredStats, setIgnoredStats] = useState<IgnoredStats | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/backlink-gap/${businessId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  const loadTopOpportunities = useCallback(async () => {
    const res = await fetch(`/api/backlink-gap/${businessId}/opportunities?page=1&pageSize=5&status=open`);
    const json = await res.json();
    if (!res.ok) return;
    setTopOpportunities(enrichOpportunities(json.items as RawOpportunity[], data?.context ?? json.context));
  }, [businessId, data?.context]);

  const loadStats = useCallback(async () => {
    const res = await fetch(`/api/backlink-gap/${businessId}/stats`);
    const json = await res.json();
    if (res.ok) setIgnoredStats(json.ignoredStats ?? null);
  }, [businessId]);

  useEffect(() => {
    load();
    loadStats();
  }, [load, loadStats]);

  useEffect(() => {
    if (data?.run?.status === "ready" || data?.run?.status === "partial") {
      loadTopOpportunities();
    }
  }, [data?.run?.status, loadTopOpportunities]);

  useEffect(() => {
    const run = data?.run;
    if (run?.status === "running") {
      const t = setInterval(load, 4000);
      return () => clearInterval(t);
    }
  }, [data?.run?.status, load]);

  async function runGap(forceRefresh = false) {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/backlink-gap/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, forceRefresh }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Analysis failed");
      await load();
      await loadStats();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setRunning(false);
    }
  }

  async function createTasks() {
    try {
      const res = await fetch("/api/backlink-gap/tasks/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Task creation failed");
    }
  }

  async function updateOpportunityStatus(opportunityId: string, status: "ignored" | "completed" | "open") {
    setUpdating(true);
    try {
      const res = await fetch("/api/backlink-gap/opportunity/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId, businessId, status }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Update failed");
      }
      setSelected(null);
      await load();
      await loadStats();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setUpdating(false);
    }
  }

  const run = data?.run;
  const context = data?.context;
  const isRunning = run?.status === "running" || running;
  const competitors = data?.competitors ?? run?.selected_competitors ?? [];

  return (
    <ModulePage>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <GapPageHeader />
        <GapTopBar businessId={businessId} />
      </div>

      <GapActionBar
          isRunning={isRunning}
          hasRun={!!run}
          loading={loading}
          onRun={() => runGap(false)}
          onRerun={() => runGap(true)}
          onCreateTasks={createTasks}
          onRefresh={load}
        />

      {error && <AlertBanner variant="error">{error}</AlertBanner>}

      {isRunning && run?.progress_stage && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-[13px] text-blue-800">
          <Loader2 className="mr-2 inline h-3.5 w-3.5 animate-spin" />
          {run.progress_stage}…
        </div>
      )}

      {tab === "ignored" && ignoredStats ? (
        <GapIgnoredKpiRow
          ignored={ignoredStats.ignored}
          spam={ignoredStats.spam}
          restored={ignoredStats.restored}
          review={ignoredStats.review}
        />
      ) : run ? (
        <GapKpiRow
          targetDomains={run.target_ref_domain_count ?? "—"}
          competitorDomains={run.competitor_ref_domain_count ?? "—"}
          missing={run.missing_opportunity_count ?? "—"}
          highPriority={run.high_priority_count ?? "—"}
        />
      ) : null}

      {run?.target_domain && (
        <GapTargetLine targetDomain={run.target_domain} competitorCount={competitors.length} />
      )}

      <GapTabs active={tab} onChange={setTab} />

      {loading && !data && (
        <div className="flex items-center justify-center py-10 text-text-muted">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          <span className="text-[13px]">Loading saved results…</span>
        </div>
      )}

      {!loading && !run && (
        <div className="rounded-xl border border-dashed border-border bg-white px-3.5 py-8 text-center text-[13px]">
          <p className="text-[13px] text-text-muted">
            No backlink gap analysis yet. Run your first analysis to find competitor link opportunities.
          </p>
        </div>
      )}

      {tab === "overview" && run && (
        <BacklinkGapOverviewTab
          businessId={businessId}
          aiSummary={run.ai_summary}
          topOpportunities={topOpportunities}
          onSelect={setSelected}
          onViewOpportunities={() => setTab("opportunities")}
          onViewTasks={() => setTab("tasks")}
        />
      )}

      {tab === "opportunities" && run && (
        <OpportunitiesPanel
          businessId={businessId}
          competitors={competitors}
          context={context}
          status="open"
          onSelect={setSelected}
        />
      )}

      {tab === "matrix" && run && (
        <BacklinkGapMatrixTab
          businessId={businessId}
          competitors={competitors}
          targetDomain={run.target_domain}
        />
      )}

      {tab === "ignored" && run && (
        <OpportunitiesPanel
          businessId={businessId}
          competitors={competitors}
          context={context}
          status="ignored"
          onSelect={setSelected}
        />
      )}

      {tab === "tasks" && (
        <BacklinkGapTasksTab
          tasks={(data?.tasks ?? []).map((t) => ({
            id: String(t.id),
            title: String(t.title),
            description: t.description != null ? String(t.description) : null,
            priority: t.priority != null ? String(t.priority) : undefined,
            impact: t.impact != null ? String(t.impact) : undefined,
            effort: t.effort != null ? String(t.effort) : undefined,
            status: t.status != null ? String(t.status) : undefined,
          }))}
        />
      )}

      {run && (
        <GapPageFooter competitorCount={competitors.length} createdAt={run.created_at} />
      )}

      {selected && (
        <SourceDetailDrawer
          opportunity={selected}
          updating={updating}
          onClose={() => setSelected(null)}
          onCreateTask={async () => {
            await fetch("/api/backlink-gap/tasks/create", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ businessId, opportunityIds: [selected.id] }),
            });
            await load();
          }}
          onIgnore={() => updateOpportunityStatus(selected.id, "ignored")}
          onComplete={() => updateOpportunityStatus(selected.id, "completed")}
        />
      )}
    </ModulePage>
  );
}

function SourceDetailDrawer({
  opportunity: o,
  updating,
  onClose,
  onCreateTask,
  onIgnore,
  onComplete,
}: {
  opportunity: EnrichedOpportunity;
  updating: boolean;
  onClose: () => void;
  onCreateTask: () => Promise<void>;
  onIgnore: () => void;
  onComplete: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <div className="flex h-full w-full max-w-lg flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-[15px] font-semibold">{o.referring_domain}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-surface-subtle">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 space-y-3.5 overflow-y-auto px-4 py-3.5 text-[13px]">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Link power (0–100)</p>
              <p className="text-base font-bold text-emerald-700">{o.powerScore ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Opportunity score</p>
              <p className="font-medium">{o.opportunity_score}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Link type</p>
              <p>
                {o.linkPassing === "passes"
                  ? "Dofollow (passes power)"
                  : o.linkPassing === "nofollow"
                    ? "Nofollow"
                    : "Unknown"}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Relevance</p>
              <p className="capitalize">{o.topicalFit}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Source type</p>
              <p>{o.source_type}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Priority</p>
              {priorityBadge(o.priority)}
            </div>
          </div>

          {o.source_url && (
            <div>
              <p className="text-xs text-text-muted">Source URL</p>
              <a
                href={o.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-emerald-700 hover:underline"
              >
                {o.source_url} <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {o.source_title && (
            <div>
              <p className="text-xs text-text-muted">Page title</p>
              <p>{o.source_title}</p>
            </div>
          )}

          {o.anchor_text && (
            <div>
              <p className="text-xs text-text-muted">Anchor text</p>
              <p className="italic">&ldquo;{o.anchor_text}&rdquo;</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-text-muted">First seen</p>
              <p>{o.first_seen ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Last seen</p>
              <p>{o.last_seen ?? "—"}</p>
            </div>
          </div>

          <div>
            <p className="text-xs text-text-muted">Linked competitors</p>
            <ul className="mt-1 list-inside list-disc">
              {(o.linked_competitors ?? []).map((c) => (
                <li key={c.name}>
                  {c.name}
                  {c.domain ? ` (${c.domain})` : ""}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs text-text-muted">Why pursue (or not)</p>
            <p className="mt-1 text-text-muted">{o.reason ?? "—"}</p>
          </div>

          <div>
            <p className="text-xs text-text-muted">Suggested outreach</p>
            <p className="mt-1 text-text-muted">{o.suggested_action ?? "—"}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            disabled={updating}
            onClick={onCreateTask}
            className="rounded-lg bg-[#16A34A] px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-[#15803D] disabled:opacity-50"
          >
            Create Task
          </button>
          <button
            type="button"
            disabled={updating}
            onClick={onIgnore}
            className="rounded-lg border border-border px-3.5 py-2 text-[13px] font-medium hover:bg-surface-subtle disabled:opacity-50"
          >
            Mark Ignore
          </button>
          <button
            type="button"
            disabled={updating}
            onClick={onComplete}
            className="rounded-lg border border-border px-3.5 py-2 text-[13px] font-medium hover:bg-surface-subtle disabled:opacity-50"
          >
            Mark Completed
          </button>
        </div>
      </div>
    </div>
  );
}
