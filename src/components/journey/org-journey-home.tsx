"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  Building2,
  FileText,
  Loader2,
  Play,
  Target,
  Users,
} from "lucide-react";
import { NextBestActionsPanel } from "@/components/journey/next-best-actions-panel";
import { SetupProgressCard } from "@/components/journey/setup-progress-card";
import {
  ActiveWorkPanel,
  NeedsAttentionPanel,
  RecentResultsPanel,
} from "@/components/journey/dashboard-work-panels";
import { WorkspaceQueueGrid } from "@/components/dashboard/workspace-queue";
import type { NextBestAction, SetupProgress } from "@/lib/journey/next-best-actions";
import type { WorkingQueue, WorkingQueueItem } from "@/lib/workspace/working-queue";
import {
  ContentCard,
  ModuleHeader,
  ModulePage,
  btnSecondary,
  cardClass,
  cardLabelClass,
  sectionTitleClass,
} from "@/components/ui/design-system";
import { cn } from "@/lib/utils";

type RecentItem = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  kind?: string;
};

type BizRow = {
  id: string;
  name: string;
  account_type?: string | null;
  is_tracked?: boolean | null;
  prospect_status?: string | null;
  created_at?: string | null;
  archived_at?: string | null;
};

const QUICK_ACTIONS = [
  {
    href: "/businesses/new?as=prospect",
    label: "Add prospect",
    hint: "Win new work",
    icon: Target,
    wrap: "bg-sky-50 text-sky-600",
  },
  {
    href: "/businesses/new?as=client",
    label: "Add client",
    hint: "Start tracking",
    icon: Building2,
    wrap: "bg-emerald-50 text-emerald-600",
  },
  {
    href: "/scans/new",
    label: "Run scan",
    hint: "Maps visibility",
    icon: Play,
    wrap: "bg-violet-50 text-violet-600",
  },
  {
    href: "/reports",
    label: "Create report",
    hint: "Deliver value",
    icon: FileText,
    wrap: "bg-amber-50 text-amber-600",
  },
] as const;

function emptyQueue(): WorkingQueue {
  return {
    scansRunning: [],
    scansCompleted: [],
    reportsDue: [],
    clientsNeedScan: [],
    schedulesUpcoming: [],
    draftReports: [],
    prospectAudits: [],
  };
}

function LocationListCard({
  title,
  subtitle,
  icon: Icon,
  iconWrap,
  rows,
  empty,
  viewAllHref,
  viewAllLabel,
  hrefFor,
}: {
  title: string;
  subtitle: string;
  icon: typeof Building2;
  iconWrap: string;
  rows: BizRow[];
  empty: string;
  viewAllHref: string;
  viewAllLabel: string;
  hrefFor: (b: BizRow) => string;
}) {
  return (
    <ContentCard padding={false} className="overflow-hidden">
      <div className="flex items-start justify-between gap-2 border-b border-zinc-100 px-3.5 py-2.5">
        <div className="flex items-start gap-2.5">
          <span
            className={cn(
              "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
              iconWrap
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
          <div>
            <h2 className={sectionTitleClass}>{title}</h2>
            <p className="mt-0.5 text-[11px] text-zinc-500">{subtitle}</p>
          </div>
        </div>
        <Link
          href={viewAllHref}
          className="shrink-0 text-[12px] font-medium text-emerald-600 hover:text-emerald-700"
        >
          {viewAllLabel}
        </Link>
      </div>
      {!rows.length ? (
        <p className="px-3.5 py-3.5 text-[12px] text-zinc-500">{empty}</p>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {rows.map((b) => (
            <li key={b.id}>
              <Link
                href={hrefFor(b)}
                className="group flex items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-zinc-50/80"
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset",
                    iconWrap,
                    "ring-black/5"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-zinc-900 group-hover:text-emerald-700">
                    {b.name}
                  </p>
                  <p className="truncate text-[11px] capitalize text-zinc-500">
                    {b.prospect_status
                      ? String(b.prospect_status).replace(/_/g, " ")
                      : title === "Prospects"
                        ? "Prospect"
                        : "Client"}
                  </p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-300 group-hover:text-emerald-600" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </ContentCard>
  );
}

/** Main freelancer home — Workspace (not a second thin queue page). */
export function OrgJourneyHome({ orgName }: { orgName?: string | null }) {
  const [actions, setActions] = useState<NextBestAction[]>([]);
  const [setup, setSetup] = useState<SetupProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<WorkingQueue>(emptyQueue);
  const [scansRunning, setScansRunning] = useState<WorkingQueueItem[]>([]);
  const [schedulesUpcoming, setSchedulesUpcoming] = useState<WorkingQueueItem[]>([]);
  const [draftReports, setDraftReports] = useState<WorkingQueueItem[]>([]);
  const [needsAttention, setNeedsAttention] = useState<WorkingQueueItem[]>([]);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [businesses, setBusinesses] = useState<BizRow[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const [nbaRes, queueRes, bizRes] = await Promise.all([
          fetch("/api/journey/next-actions?setup=1"),
          fetch("/api/journey/work-queue"),
          fetch("/api/businesses"),
        ]);
        const nbaJson = await nbaRes.json();
        if (nbaRes.ok) {
          setActions(nbaJson.actions ?? []);
          setSetup(nbaJson.setup ?? null);
        }
        const queueJson = await queueRes.json();
        if (queueRes.ok) {
          setQueue(queueJson.queue ?? emptyQueue());
          setScansRunning(queueJson.activeWork?.scansRunning ?? []);
          setSchedulesUpcoming(queueJson.activeWork?.schedulesUpcoming ?? []);
          setDraftReports(queueJson.activeWork?.draftReports ?? []);
          setNeedsAttention(queueJson.needsAttention ?? []);
          setRecent(queueJson.recent ?? []);
        }
        const bizJson = await bizRes.json();
        if (bizRes.ok) {
          setBusinesses((bizJson.businesses as BizRow[]) ?? []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const { recentClients, recentProspects } = useMemo(() => {
    const active = businesses.filter((b) => !b.archived_at);
    const byRecent = [...active].sort((a, b) =>
      String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""))
    );
    const prospects = byRecent
      .filter((b) => b.account_type === "prospect" || b.is_tracked === false)
      .slice(0, 3);
    const clients = byRecent
      .filter((b) => b.account_type !== "prospect" && b.is_tracked !== false)
      .slice(0, 3);
    return { recentClients: clients, recentProspects: prospects };
  }, [businesses]);

  const activeCount =
    scansRunning.length + schedulesUpcoming.length + draftReports.length;
  const attentionCount = needsAttention.length;

  return (
    <ModulePage wide>
      <ModuleHeader
        icon={Briefcase}
        title="Workspace"
        subtitle={
          orgName?.trim()
            ? `${orgName.trim()} — what is happening now, who needs attention, and what to do next.`
            : "What is happening now, who needs attention, and what to do next."
        }
      />

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {QUICK_ACTIONS.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.href}
              href={a.href}
              className={cn(
                cardClass,
                "flex items-center gap-3 p-3.5 transition hover:border-emerald-200 hover:bg-emerald-50/30"
              )}
            >
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ring-black/5",
                  a.wrap
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-zinc-900">
                  {a.label}
                </span>
                <span className="block text-[11px] text-zinc-500">{a.hint}</span>
              </span>
            </Link>
          );
        })}
      </div>

      {!loading ? (
        <div className="grid gap-2 sm:grid-cols-3">
          <div className={cn(cardClass, "p-3.5")}>
            <p className={cardLabelClass}>Active work</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-zinc-900">
              {activeCount}
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              {scansRunning.length} scans · {draftReports.length} drafts
            </p>
          </div>
          <div className={cn(cardClass, "p-3.5")}>
            <p className={cardLabelClass}>Needs attention</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-zinc-900">
              {attentionCount}
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              Overdue scans, drafts, follow-ups
            </p>
          </div>
          <div className={cn(cardClass, "p-3.5")}>
            <p className={cardLabelClass}>Locations</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-zinc-900">
              {recentClients.length + recentProspects.length > 0
                ? businesses.filter((b) => !b.archived_at).length
                : 0}
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              Clients + prospects in your org
            </p>
          </div>
        </div>
      ) : null}

      {/* Clients + prospects first — pick without leaving the page */}
      <div className="grid gap-3 lg:grid-cols-2">
        <LocationListCard
          title="Clients"
          subtitle="Recent clients — open one to work the full toolset."
          icon={Building2}
          iconWrap="bg-emerald-50 text-emerald-600"
          rows={recentClients}
          empty="No clients yet. Add a client to start recurring tracking."
          viewAllHref="/clients"
          viewAllLabel="View all"
          hrefFor={(b) => `/clients/${b.id}`}
        />
        <LocationListCard
          title="Prospects"
          subtitle="Recent prospects — audit, report, then convert."
          icon={Users}
          iconWrap="bg-sky-50 text-sky-600"
          rows={recentProspects}
          empty="No prospects yet. Add a prospect to run your first audit."
          viewAllHref="/prospects"
          viewAllLabel="View all"
          hrefFor={(b) => `/prospects/${b.id}`}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
        <div className="space-y-3">
          {loading ? (
            <ContentCard className="flex items-center gap-2 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
              Loading your workspace…
            </ContentCard>
          ) : (
            <>
              <NextBestActionsPanel actions={actions} />
              <div className="grid gap-3 xl:grid-cols-2">
                <ActiveWorkPanel
                  scansRunning={scansRunning}
                  schedulesUpcoming={schedulesUpcoming}
                  draftReports={draftReports}
                />
                <NeedsAttentionPanel items={needsAttention} />
              </div>
              <RecentResultsPanel items={recent} />
              <div>
                <div className="mb-2 flex items-end justify-between gap-2">
                  <div>
                    <h2 className={sectionTitleClass}>Full work queue</h2>
                    <p className="mt-0.5 text-[11px] text-zinc-500">
                      Scans, reports due, schedules, and prospect follow-ups.
                    </p>
                  </div>
                </div>
                <WorkspaceQueueGrid queue={queue} />
              </div>
            </>
          )}
        </div>

        <div className="space-y-3">
          {setup ? <SetupProgressCard progress={setup} /> : null}
          <ContentCard padding={false} className="overflow-hidden">
            <div className="border-b border-zinc-100 px-3.5 py-2.5">
              <h2 className={sectionTitleClass}>Quick jumps</h2>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                Same menu everywhere — tools stay visible.
              </p>
            </div>
            <div className="grid gap-1.5 p-2.5">
              {[
                { href: "/scans/new", label: "New Maps scan" },
                { href: "/reports", label: "Reports home" },
                { href: "/onboarding", label: "Get started guide" },
                { href: "/branding", label: "Branding" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(btnSecondary, "h-9 justify-start px-3 text-[12px]")}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </ContentCard>
        </div>
      </div>
    </ModulePage>
  );
}
