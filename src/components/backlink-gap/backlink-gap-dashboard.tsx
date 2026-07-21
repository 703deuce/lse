"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Link2, ListPlus, Loader2, Play, RefreshCw, X, ExternalLink } from "lucide-react";
import { OpportunitiesPanel, type EnrichedOpportunity } from "@/components/backlink-gap/opportunities-panel";
import { enrichOpportunities } from "@/lib/backlink-gap/enrich";
import type { BusinessContext } from "@/lib/backlink-gap/enrich";
import type { RawOpportunity } from "@/lib/backlink-gap/enrich";
import {
  BacklinkGapTabId,
  GapIgnoredKpiRow,
  GapKpiRow,
  GapPageFooter,
  GapTabs,
  GapTargetLine,
  priorityBadge,
} from "@/components/backlink-gap/backlink-gap-ui";
import {
  ModulePage,
  PageHeader,
  AlertBanner,
  ModuleSkeleton,
  btnGhost,
  btnPrimary,
  btnSecondary,
} from "@/components/ui/design-system";
import { ModuleEmptyState } from "@/components/journey/module-empty-state";
import { BacklinkGapOverviewTab } from "@/components/backlink-gap/backlink-gap-overview-tab";
import { BacklinkGapMatrixTab } from "@/components/backlink-gap/backlink-gap-matrix-tab";
import { BacklinkGapTasksTab } from "@/components/backlink-gap/backlink-gap-tasks-tab";
import { useModuleJobRunner } from "@/components/jobs/use-module-job-runner";
import { cn } from "@/lib/utils";

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
  const [selected, setSelected] = useState<EnrichedOpportunity | null>(null);
  const [updating, setUpdating] = useState(false);
  const [topOpportunities, setTopOpportunities] = useState<EnrichedOpportunity[]>([]);
  const [ignoredStats, setIgnoredStats] = useState<IgnoredStats | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
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
    void load();
    void loadStats();
  }, [load, loadStats]);

  useEffect(() => {
    if (data?.run?.status === "ready" || data?.run?.status === "partial") {
      void loadTopOpportunities();
    }
  }, [data?.run?.status, loadTopOpportunities]);

  const {
    start: startJob,
    running,
    error,
    setError,
  } = useModuleJobRunner({
    onSettled: async () => {
      await load();
      await loadStats();
    },
  });

  async function runGap(forceRefresh = false) {
    try {
      await startJob(
        "/api/backlink-gap/run",
        { businessId, forceRefresh },
        "Analysis failed"
      );
    } catch {
      /* error already set by runner */
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
      <PageHeader
        title="Backlink Gap"
        description="Identify the most valuable domains linking to competitors but not to you."
        primaryAction={
          <button
            type="button"
            onClick={() => runGap(false)}
            disabled={isRunning}
            className={btnPrimary}
          >
            {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
            {isRunning ? "Analyzing..." : "Run analysis"}
          </button>
        }
        secondaryActions={
          <>
            <Link href={`/businesses/${businessId}/scans`} className={cn(btnGhost, "h-9 px-3 text-[13px]")}>
              Maps scans
            </Link>
            <button
              type="button"
              onClick={() => runGap(true)}
              disabled={isRunning || !run}
              className={cn(btnSecondary, "h-9 px-3 text-[13px]")}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Re-run
            </button>
            <button
              type="button"
              onClick={createTasks}
              disabled={!run || isRunning}
              className={cn(btnSecondary, "h-9 px-3 text-[13px]")}
            >
              <ListPlus className="h-3.5 w-3.5" />
              Create tasks
            </button>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className={cn(btnGhost, "h-9 px-3 text-[13px]")}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              Refresh
            </button>
          </>
        }
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

      {loading && !data && <ModuleSkeleton rows={5} />}

      {!loading && !run && (
        <ModuleEmptyState
          icon={Link2}
          title="No Backlink Gap yet"
          description="Compare your client with competitors to find local and industry backlink opportunities - then save, create tasks, and include a summary in the next report."
          actionLabel="Run Backlink Gap"
          onAction={() => void runGap(false)}
        />
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
          businessId={businessId}
          opportunity={selected}
          updating={updating}
          onClose={() => setSelected(null)}
          onCreateTask={async () => {
            const res = await fetch("/api/backlink-gap/tasks/create", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ businessId, opportunityIds: [selected.id] }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
              setError(typeof json.error === "string" ? json.error : "Failed to create task");
              return;
            }
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
  businessId,
  opportunity: o,
  updating,
  onClose,
  onCreateTask,
  onIgnore,
  onComplete,
}: {
  businessId: string;
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
            Dismiss
          </button>
          <button
            type="button"
            disabled={updating}
            onClick={onComplete}
            className="rounded-lg border border-border px-3.5 py-2 text-[13px] font-medium hover:bg-surface-subtle disabled:opacity-50"
          >
            Mark acquired
          </button>
          {businessId && o ? (
            <button
              type="button"
              disabled={updating}
              onClick={() => {
                void import("@/lib/journey/report-staging").then(({ stageReportItem }) => {
                  stageReportItem({
                    businessId,
                    source: "backlink_gap",
                    title: String(o.referring_domain ?? o.source_url ?? "Backlink opportunity"),
                    href: `/businesses/${businessId}/backlink-gap`,
                    meta: { opportunityId: String(o.id), status: String(o.status ?? "open") },
                  });
                });
              }}
              className="rounded-lg border border-border px-3.5 py-2 text-[13px] font-medium hover:bg-surface-subtle disabled:opacity-50"
            >
              Add to report
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
