"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GrowthAuditActionPlanTab } from "@/components/growth-audit/growth-audit-action-plan-tab";
import { GrowthAuditCompetitorTab } from "@/components/growth-audit/growth-audit-competitor-tab";
import { GrowthAuditCoverageTab } from "@/components/growth-audit/growth-audit-coverage-tab";
import { GrowthAuditGbpTab } from "@/components/growth-audit/growth-audit-gbp-tab";
import { GrowthAuditOverviewTab } from "@/components/growth-audit/growth-audit-overview-tab";
import {
  GROWTH_AUDIT_TABS,
  GrowthAuditHeader,
  GrowthAuditTabs,
  type GrowthAuditTabId,
} from "@/components/growth-audit/growth-audit-ui";
import { GrowthAuditWebsiteTab } from "@/components/growth-audit/growth-audit-website-tab";
import type { ExtendedModuleStatus, GrowthAuditSections } from "@/lib/growth-audit/types";
import { ModulePage, AlertBanner, ModuleSkeleton, btnPrimary } from "@/components/ui/design-system";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useModuleJobRunner } from "@/components/jobs/use-module-job-runner";
import { useActiveJobStatus } from "@/components/jobs/use-active-job-status";
import { isTerminalJobStatus } from "@/lib/jobs/active-job-status";

const LEGACY_TABS: Record<string, GrowthAuditTabId> = {
  "service-coverage": "coverage",
  "local-coverage": "coverage",
  "action-plan": "growth-plan",
};

function ExtendedModulesBanner({
  businessId,
  extended,
  status,
  progressStage,
}: {
  businessId: string;
  extended: ExtendedModuleStatus;
  status: string;
  progressStage: string | null;
}) {
  const running = status === "extended_running" || status === "running";
  const modules = [
    { key: "citations", label: "Citations", href: `/businesses/${businessId}/citations`, data: extended.citations },
    { key: "reputation", label: "Reputation", href: `/businesses/${businessId}/reputation`, data: extended.reputation },
    { key: "keywords", label: "Keywords", href: `/businesses/${businessId}/keywords`, data: extended.keywords },
    { key: "backlinkGap", label: "Backlink Gap", href: `/businesses/${businessId}/backlink-gap`, data: extended.backlinkGap },
  ];

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[13px]">
      <p className="text-[13px] font-medium text-zinc-900">
        Extended modules {running ? "(running in background…)" : ""}
      </p>
      {progressStage && running && <p className="mt-0.5 text-[11px] text-zinc-500">{progressStage}</p>}
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {modules.map((m) => (
          <Link
            key={m.key}
            href={m.href}
            className={cn(
              "rounded-md px-2 py-0.5 text-[11px] font-medium",
              m.data?.status === "complete" ||
                m.data?.status === "empty" ||
                m.data?.status === "ready" ||
                m.data?.status === "partial"
                ? "bg-emerald-100 text-emerald-800"
                : m.data?.status === "failed"
                  ? "bg-red-100 text-red-800"
                  : "bg-amber-100 text-amber-800"
            )}
          >
            {m.label}: {m.data?.status ?? (running ? "pending" : "—")}
          </Link>
        ))}
      </div>
    </div>
  );
}

function resolveTab(param: string | null): GrowthAuditTabId {
  if (!param) return "overview";
  if (param in LEGACY_TABS) return LEGACY_TABS[param];
  return GROWTH_AUDIT_TABS.some((t) => t.id === param) ? (param as GrowthAuditTabId) : "overview";
}

export function GrowthAuditDashboard({ businessId }: { businessId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [tab, setTab] = useState<GrowthAuditTabId>(() => resolveTab(tabParam));
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState<GrowthAuditSections | null>(null);
  const [growthScore, setGrowthScore] = useState<number | null>(null);
  const [runStatus, setRunStatus] = useState<string>("none");
  const [extended, setExtended] = useState<ExtendedModuleStatus>({});
  const [progressStage, setProgressStage] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);

  useEffect(() => {
    setTab(resolveTab(tabParam));
  }, [tabParam]);

  const goToTab = useCallback(
    (next: GrowthAuditTabId) => {
      setTab(next);
      const url = `/businesses/${businessId}/growth-audit?tab=${next}`;
      router.replace(url, { scroll: false });
    },
    [businessId, router]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/growth-audit/${businessId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      if (json.run) {
        setSections(json.run.sections);
        setGrowthScore(json.run.growthScore);
        setRunStatus(json.run.status);
        setExtended(json.run.extended ?? {});
        setProgressStage(json.run.progressStage);
        setStartedAt(json.run.startedAt);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  const {
    start: startJob,
    running: jobRunning,
    error,
    setError,
  } = useModuleJobRunner({
    onSettled: async () => {
      await load();
      setStartedAt((prev) => prev ?? new Date().toISOString());
    },
  });

  // Extended phase / page-refresh mid-run: shared adaptive poller (not full payload).
  const featureInProgress =
    !jobRunning &&
    (runStatus === "extended_running" ||
      runStatus === "running" ||
      runStatus === "core_ready" ||
      runStatus === "queued");

  const { status: featurePoll } = useActiveJobStatus({
    statusUrl: featureInProgress ? `/api/growth-audit/${businessId}/status` : null,
    enabled: featureInProgress,
    isTerminal: (s) => s === "complete" || s === "failed" || isTerminalJobStatus(s),
    mapResponse: (json) => ({
      jobId: String(json.runId ?? businessId),
      status: String(json.status ?? "unknown"),
      phase: "active",
      progress: undefined,
      updatedAt: (json.finishedAt as string | null) ?? null,
      errorMessage: null,
      result: json,
    }),
  });

  const lastFeatureStatus = useRef<string | null>(null);
  useEffect(() => {
    if (!featurePoll?.result || typeof featurePoll.result !== "object") return;
    const json = featurePoll.result as {
      status?: string;
      extended?: ExtendedModuleStatus;
      progressStage?: string | null;
    };
    if (!json.status) return;
    // Only write state when the feature status actually changes — avoid
    // re-render churn from new result object identities on every poll.
    const prev = lastFeatureStatus.current;
    if (prev === json.status) return;
    lastFeatureStatus.current = json.status;
    setRunStatus(json.status);
    setExtended(json.extended ?? {});
    setProgressStage(json.progressStage ?? null);
    if (json.status === "complete" || json.status === "failed" || json.status === "core_ready") {
      void load();
    }
  }, [featurePoll, load]);

  async function runAudit() {
    try {
      setRunStatus("queued");
      setStartedAt(new Date().toISOString());
      await startJob("/api/growth-audit/run", { businessId }, "Audit failed");
    } catch {
      /* error already set by runner */
    }
  }

  const running =
    jobRunning ||
    runStatus === "extended_running" ||
    runStatus === "running" ||
    runStatus === "core_ready" ||
    runStatus === "queued";

  if (loading && !sections) {
    return (
      <ModulePage wide>
        <ModuleSkeleton rows={6} />
      </ModulePage>
    );
  }

  const score = growthScore ?? sections?.overview.growthScore ?? 0;

  return (
    <ModulePage wide>
      <GrowthAuditHeader startedAt={startedAt} running={running} onRun={() => void runAudit()} />

      {error && <AlertBanner variant="error">{error}</AlertBanner>}

      {!sections ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white px-3.5 py-8 text-center">
          <h2 className="text-[15px] font-semibold text-zinc-900">No Growth Audit yet</h2>
          <p className="mx-auto mt-2 max-w-md text-[13px] text-zinc-500">
            Run a Growth Audit to identify gaps across the business profile, website, local coverage
            and competitors — then create tasks and add findings to a client report.
          </p>
          <button
            type="button"
            onClick={() => void runAudit()}
            disabled={running}
            className={cn(btnPrimary, "mt-4 h-9 px-3 disabled:opacity-50")}
          >
            {running ? "Running…" : "Run Growth Audit"}
          </button>
        </div>
      ) : (
        <>
          {(runStatus === "extended_running" || runStatus === "core_ready") && (
            <ExtendedModulesBanner
              businessId={businessId}
              extended={extended}
              status={runStatus}
              progressStage={progressStage}
            />
          )}

          <GrowthAuditTabs tab={tab} onTabChange={goToTab} />

          {tab === "overview" && (
            <GrowthAuditOverviewTab
              businessId={businessId}
              sections={sections}
              growthScore={score}
              onGoToActionPlan={() => goToTab("growth-plan")}
            />
          )}
          {tab === "gbp" && (
            <GrowthAuditGbpTab gbp={sections.gbp} onGoToActionPlan={() => goToTab("growth-plan")} />
          )}
          {tab === "website" && (
            <GrowthAuditWebsiteTab website={sections.website} onGoToActionPlan={() => goToTab("growth-plan")} />
          )}
          {tab === "coverage" && <GrowthAuditCoverageTab sections={sections} />}
          {tab === "competitor-gap" && (
            <GrowthAuditCompetitorTab
              sections={sections}
              businessName={sections.gbp.profile.name}
              onGoToActionPlan={() => goToTab("growth-plan")}
            />
          )}
          {tab === "growth-plan" && (
            <GrowthAuditActionPlanTab
              businessId={businessId}
              sections={sections}
              onGoToOverview={() => goToTab("overview")}
            />
          )}
        </>
      )}
    </ModulePage>
  );
}
