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
  GapEmptyState,
  GapIgnoredKpiRow,
  GapKpiRow,
  GapPageFooter,
  GapPageHeader,
  GapTabs,
  GapTargetLine,
  GapTopBar,
  priorityBadge,
} from "@/components/backlink-gap/backlink-gap-ui";
import { mock } from "@/components/mockup/ui";
import { ModulePage, AlertBanner } from "@/components/ui/design-system";
import { cn } from "@/lib/utils";
import { BacklinkGapOverviewTab } from "@/components/backlink-gap/backlink-gap-overview-tab";
import { BacklinkGapMatrixTab } from "@/components/backlink-gap/backlink-gap-matrix-tab";
import { BacklinkGapTasksTab } from "@/components/backlink-gap/backlink-gap-tasks-tab";
import { useModuleJobRunner } from "@/components/jobs/use-module-job-runner";

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
    <ModulePage wide className={cn(mock.page, "bg-transparent")}>
      <GapPageHeader actions={<GapTopBar businessId={businessId} />} />

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
        <div className="rounded-xl border border-[#B2DDFF] bg-[#EFF8FF] px-4 py-3 text-sm text-[#175CD3]">
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
        <div className="flex items-center justify-center py-10 text-[#667085]">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          <span className="text-sm">Loading saved results…</span>
        </div>
      )}

      {!loading && !run && (
        <GapEmptyState
          title="No Backlink Gap yet"
          body="Compare your client with competitors to find local and industry backlink opportunities — then save, create tasks, and include a summary in the next report."
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
        <div className="flex items-center justify-between border-b border-[#E6EAF0] px-4 py-3">
          <h2 className="text-base font-semibold text-[#101828]">{o.referring_domain}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-[#F2F4F7]">
            <X className="h-4 w-4 text-[#667085]" />
          </button>
        </div>
        <div className="flex-1 space-y-3.5 overflow-y-auto px-4 py-3.5 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className={mock.label}>Link power (0–100)</p>
              <p className="mt-1 text-base font-bold text-[#137752]">{o.powerScore ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-[#667085]">Opportunity score</p>
              <p className="font-medium text-[#101828]">{o.opportunity_score}</p>
            </div>
            <div>
              <p className="text-xs text-[#667085]">Link type</p>
              <p className="text-[#344054]">
                {o.linkPassing === "passes"
                  ? "Dofollow (passes power)"
                  : o.linkPassing === "nofollow"
                    ? "Nofollow"
                    : "Unknown"}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#667085]">Relevance</p>
              <p className="capitalize text-[#344054]">{o.topicalFit}</p>
            </div>
            <div>
              <p className="text-xs text-[#667085]">Source type</p>
              <p className="text-[#344054]">{o.source_type}</p>
            </div>
            <div>
              <p className="text-xs text-[#667085]">Priority</p>
              {priorityBadge(o.priority)}
            </div>
          </div>

          {o.source_url && (
            <div>
              <p className="text-xs text-[#667085]">Source URL</p>
              <a
                href={o.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[#137752] hover:underline"
              >
                {o.source_url} <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {o.source_title && (
            <div>
              <p className="text-xs text-[#667085]">Page title</p>
              <p className="text-[#344054]">{o.source_title}</p>
            </div>
          )}

          {o.anchor_text && (
            <div>
              <p className="text-xs text-[#667085]">Anchor text</p>
              <p className="italic text-[#344054]">&ldquo;{o.anchor_text}&rdquo;</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-[#667085]">First seen</p>
              <p className="text-[#344054]">{o.first_seen ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-[#667085]">Last seen</p>
              <p className="text-[#344054]">{o.last_seen ?? "—"}</p>
            </div>
          </div>

          <div>
            <p className="text-xs text-[#667085]">Linked competitors</p>
            <ul className="mt-1 list-inside list-disc text-[#344054]">
              {(o.linked_competitors ?? []).map((c) => (
                <li key={c.name}>
                  {c.name}
                  {c.domain ? ` (${c.domain})` : ""}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs text-[#667085]">Why pursue (or not)</p>
            <p className="mt-1 text-[#667085]">{o.reason ?? "—"}</p>
          </div>

          <div>
            <p className="text-xs text-[#667085]">Suggested outreach</p>
            <p className="mt-1 text-[#667085]">{o.suggested_action ?? "—"}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-[#E6EAF0] px-4 py-3">
          <button
            type="button"
            disabled={updating}
            onClick={onCreateTask}
            className={cn(mock.btnPrimary, "disabled:opacity-50")}
          >
            Create Task
          </button>
          <button
            type="button"
            disabled={updating}
            onClick={onIgnore}
            className={cn(mock.btnSecondary, "disabled:opacity-50")}
          >
            Dismiss
          </button>
          <button
            type="button"
            disabled={updating}
            onClick={onComplete}
            className={cn(mock.btnSecondary, "disabled:opacity-50")}
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
              className={cn(mock.btnSecondary, "disabled:opacity-50")}
            >
              Add to report
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
