"use client";

import {
  ArrowRight,
  MapPin,
  Play,
} from "lucide-react";
import { SetupProgressCard } from "@/components/journey/setup-progress-card";
import {
  ActiveWorkPanel,
  RecentResultsPanel,
} from "@/components/journey/dashboard-work-panels";
import { WorkspaceQueueGrid } from "@/components/dashboard/workspace-queue";
import { CancelActiveScansButton } from "@/components/scan/cancel-active-scans-button";
import type { NextBestAction, SetupProgress } from "@/lib/journey/next-best-actions";
import type { WorkingQueue, WorkingQueueItem } from "@/lib/workspace/working-queue";
import {
  ContentCard,
  HeroPanel,
  ModulePage,
  ModuleSkeleton,
  btnGhost,
  btnPrimaryLg,
  sectionTitleClass,
} from "@/components/ui/design-system";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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
  primary_category?: string | null;
  address_text?: string | null;
  scan_center_label?: string | null;
  primary_contact_name?: string | null;
  created_at?: string | null;
  archived_at?: string | null;
};

const emptyQueue = (): WorkingQueue => ({
  scansRunning: [],
  scansCompleted: [],
  reportsDue: [],
  clientsNeedScan: [],
  schedulesUpcoming: [],
  draftReports: [],
  prospectAudits: [],
});

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function locationMeta(b: BizRow, mode: "clients" | "prospects"): string {
  const category = b.primary_category?.trim();
  const place =
    b.scan_center_label?.trim() ||
    b.address_text?.trim()?.split(",")[0]?.trim() ||
    "";
  if (mode === "prospects") {
    const status = b.prospect_status
      ? String(b.prospect_status).replace(/_/g, " ")
      : "Prospect";
    if (place) return `${status} · ${place}`;
    if (category) return `${status} · ${category}`;
    return status;
  }
  if (category && place) return `${category} · ${place}`;
  return category || place || "Active client";
}

function LocationRoster({
  title,
  subtitle,
  mode,
  accent,
  rows,
  empty,
  viewAllHref,
  hrefFor,
}: {
  title: string;
  subtitle: string;
  mode: "clients" | "prospects";
  accent: "emerald" | "sky";
  rows: BizRow[];
  empty: string;
  viewAllHref: string;
  hrefFor: (b: BizRow) => string;
}) {
  const chip =
    accent === "emerald"
      ? "bg-emerald-50 text-emerald-800 ring-emerald-100"
      : "bg-sky-50 text-sky-800 ring-sky-100";
  const avatar =
    accent === "emerald"
      ? "bg-emerald-100 text-emerald-800 ring-emerald-200/80"
      : "bg-sky-100 text-sky-800 ring-sky-200/80";

  return (
    <ContentCard padding={false} className="overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold tracking-tight text-zinc-900">{title}</h2>
          <p className="mt-0.5 max-w-sm text-[12px] leading-snug text-zinc-500">{subtitle}</p>
        </div>
        <Link
          href={viewAllHref}
          className="shrink-0 text-[12px] font-medium text-[#137752] hover:text-[#0f6344]"
        >
          View all
        </Link>
      </div>

      {!rows.length ? (
        <div className="px-4 py-5">
          <p className="text-[13px] text-zinc-500">{empty}</p>
          <Link
            href={mode === "clients" ? "/businesses/new?as=client" : "/businesses/new?as=prospect"}
            className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#137752] hover:text-[#0f6344]"
          >
            Add {mode === "clients" ? "client" : "prospect"}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <ul className="grid gap-1.5 p-2.5 sm:grid-cols-1">
          {rows.map((b) => (
            <li key={b.id}>
              <Link
                href={hrefFor(b)}
                className="group flex items-center gap-3 rounded-md border border-transparent px-2.5 py-2.5 transition hover:border-zinc-200 hover:bg-zinc-50"
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[12px] font-semibold tracking-wide ring-1 ring-inset",
                    avatar
                  )}
                >
                  {initials(b.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[13px] font-semibold text-zinc-900 group-hover:text-[#137752]">
                      {b.name}
                    </p>
                    <span
                      className={cn(
                        "hidden shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset sm:inline",
                        chip
                      )}
                    >
                      {mode === "clients" ? "Client" : "Prospect"}
                    </span>
                  </div>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-zinc-500">
                    <MapPin className="h-3 w-3 shrink-0 text-zinc-400" />
                    <span className="truncate">{locationMeta(b, mode)}</span>
                  </p>
                  {b.primary_contact_name?.trim() ? (
                    <p className="mt-0.5 truncate text-[11px] text-zinc-400">
                      {b.primary_contact_name.trim()}
                    </p>
                  ) : null}
                </div>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-300 transition group-hover:text-[#137752]" />
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
      .slice(0, 5);
    const clients = byRecent
      .filter((b) => b.account_type !== "prospect" && b.is_tracked !== false)
      .slice(0, 5);
    return {
      recentClients: clients,
      recentProspects: prospects,
    };
  }, [businesses]);

  const attentionCount = needsAttention.length;
  const runningCount = scansRunning.length || queue.scansRunning.length;
  const reportsReady = draftReports.length || queue.draftReports.length;
  const greetingHour = new Date().getHours();
  const greeting =
    greetingHour < 12 ? "Good morning" : greetingHour < 17 ? "Good afternoon" : "Good evening";

  const workQueueItems: Array<{
    priority: "High" | "Medium" | "Low";
    title: string;
    href: string;
  }> = [
    ...needsAttention.slice(0, 4).map((item, i) => ({
      priority: (i === 0 ? "High" : i === 1 ? "Medium" : "Low") as "High" | "Medium" | "Low",
      title: item.title,
      href: item.href,
    })),
    ...actions.slice(0, Math.max(0, 4 - needsAttention.length)).map((a, i) => ({
      priority: (needsAttention.length + i === 0
        ? "High"
        : needsAttention.length + i === 1
          ? "Medium"
          : "Low") as "High" | "Medium" | "Low",
      title: a.title,
      href: a.href,
    })),
  ].slice(0, 5);

  const clientCount = businesses.filter(
    (b) => !b.archived_at && b.account_type !== "prospect" && b.is_tracked !== false
  ).length;
  const prospectCount = businesses.filter(
    (b) => !b.archived_at && (b.account_type === "prospect" || b.is_tracked === false)
  ).length;

  return (
    <ModulePage wide>
      {loading ? (
        <ModuleSkeleton rows={6} />
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-[28px] font-bold tracking-tight text-[var(--text)] sm:text-[32px]">
                {greeting}
                {orgName?.trim() ? (
                  <span className="font-semibold text-[var(--text-secondary)]">
                    {" "}
                    · {orgName.trim()}
                  </span>
                ) : null}
              </h1>
              <p className="mt-1.5 text-[15px] text-[var(--text-secondary)]">
                Decide what to work on next across your locations.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/businesses/new?as=client" className={btnGhost}>
                + Client
              </Link>
              <Link href="/businesses/new?as=prospect" className={btnGhost}>
                + Prospect
              </Link>
              <Link href="/reports" className={btnGhost}>
                Create report
              </Link>
              <Link href="/scans/new" className={btnPrimaryLg}>
                <Play className="h-4 w-4 fill-current" />
                Run scan
              </Link>
            </div>
          </div>

          <HeroPanel
            eyebrow="Today"
            title={
              attentionCount > 0
                ? `${attentionCount} item${attentionCount === 1 ? "" : "s"} need attention`
                : "You're caught up"
            }
            description={
              attentionCount > 0
                ? [
                    runningCount > 0 ? `${runningCount} scan${runningCount === 1 ? "" : "s"} running` : null,
                    reportsReady > 0
                      ? `${reportsReady} report${reportsReady === 1 ? "" : "s"} ready`
                      : null,
                    `${clientCount} client${clientCount === 1 ? "" : "s"} · ${prospectCount} prospect${prospectCount === 1 ? "" : "s"}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : `${clientCount} clients · ${prospectCount} prospects · queue is clear`
            }
            actions={
              attentionCount > 0 && workQueueItems[0] ? (
                <Link href={workQueueItems[0].href} className={btnPrimaryLg}>
                  Open next item
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <Link href="/scans/new" className={btnPrimaryLg}>
                  <Play className="h-4 w-4 fill-current" />
                  Run scan
                </Link>
              )
            }
          />

          <div className="grid gap-6 lg:grid-cols-12">
            <section className="space-y-3 lg:col-span-7">
              <h2 className={sectionTitleClass}>Work queue</h2>
              {workQueueItems.length === 0 ? (
                <ContentCard>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Nothing urgent. Run a scan or open a client overview when you&apos;re ready.
                  </p>
                </ContentCard>
              ) : (
                <ContentCard padding={false} className="overflow-hidden">
                  <ul className="divide-y divide-zinc-100">
                    {workQueueItems.map((item) => (
                      <li key={`${item.priority}-${item.href}-${item.title}`}>
                        <Link
                          href={item.href}
                          className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-zinc-50"
                        >
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                              item.priority === "High" && "bg-red-50 text-red-700",
                              item.priority === "Medium" && "bg-amber-50 text-amber-800",
                              item.priority === "Low" && "bg-zinc-100 text-zinc-600"
                            )}
                          >
                            {item.priority}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--text)]">
                            {item.title}
                          </span>
                          <ArrowRight className="h-4 w-4 shrink-0 text-zinc-300" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </ContentCard>
              )}
            </section>

            <section className="space-y-3 lg:col-span-5">
              <h2 className={sectionTitleClass}>Portfolio</h2>
              <div className="grid grid-cols-2 gap-3">
                <ContentCard>
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                    Locations
                  </p>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--text)]">
                    {clientCount + prospectCount}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    {clientCount} clients · {prospectCount} prospects
                  </p>
                </ContentCard>
                <ContentCard>
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                    Needs attention
                  </p>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--text)]">
                    {attentionCount}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    {runningCount > 0 ? `${runningCount} running now` : "No active scans"}
                  </p>
                </ContentCard>
              </div>
              <ActiveWorkPanel
                scansRunning={scansRunning}
                schedulesUpcoming={schedulesUpcoming}
                draftReports={draftReports}
              />
            </section>
          </div>

          {setup && !setup.complete ? <SetupProgressCard progress={setup} /> : null}

          <div className="grid gap-6 lg:grid-cols-2">
            <LocationRoster
              title="Clients"
              subtitle={`${recentClients.length} recent`}
              mode="clients"
              accent="emerald"
              rows={recentClients}
              empty="No clients yet."
              viewAllHref="/clients"
              hrefFor={(b) => `/businesses/${b.id}/overview`}
            />
            <LocationRoster
              title="Prospects"
              subtitle={`${recentProspects.length} recent`}
              mode="prospects"
              accent="sky"
              rows={recentProspects}
              empty="No prospects yet."
              viewAllHref="/prospects"
              hrefFor={(b) => `/businesses/${b.id}/overview`}
            />
          </div>

          <RecentResultsPanel items={recent} />

          <div>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <h2 className={sectionTitleClass}>Live queue</h2>
              {scansRunning.length > 0 || queue.scansRunning.length > 0 ? (
                <CancelActiveScansButton label="Cancel all scans" />
              ) : null}
            </div>
            <WorkspaceQueueGrid queue={queue} />
          </div>
        </>
      )}
    </ModulePage>
  );
}
