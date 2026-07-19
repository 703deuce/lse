"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  Building2,
  FileText,
  Loader2,
  MapPin,
  Play,
  Target,
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
  primary_category?: string | null;
  address_text?: string | null;
  scan_center_label?: string | null;
  primary_contact_name?: string | null;
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
  const band =
    accent === "emerald"
      ? "from-emerald-600/90 via-emerald-700/80 to-teal-800/90"
      : "from-sky-600/90 via-sky-700/80 to-cyan-800/90";
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
      <div className={cn("relative overflow-hidden bg-gradient-to-br px-4 py-3.5 text-white", band)}>
        <div className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70">
              {mode === "clients" ? "Your book" : "Pipeline"}
            </p>
            <h2 className="mt-0.5 text-[15px] font-semibold tracking-tight">{title}</h2>
            <p className="mt-1 max-w-sm text-[12px] leading-snug text-white/75">{subtitle}</p>
          </div>
          <Link
            href={viewAllHref}
            className="shrink-0 rounded-lg bg-white/15 px-2.5 py-1.5 text-[12px] font-medium text-white ring-1 ring-inset ring-white/20 transition hover:bg-white/25"
          >
            View all
          </Link>
        </div>
      </div>

      {!rows.length ? (
        <div className="px-4 py-5">
          <p className="text-[13px] text-zinc-500">{empty}</p>
          <Link
            href={mode === "clients" ? "/businesses/new?as=client" : "/businesses/new?as=prospect"}
            className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-emerald-700 hover:text-emerald-800"
          >
            Add {mode === "clients" ? "client" : "prospect"}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <ul className="grid gap-2 p-3 sm:grid-cols-1">
          {rows.map((b) => (
            <li key={b.id}>
              <Link
                href={hrefFor(b)}
                className="group flex items-center gap-3 rounded-xl border border-zinc-200/70 bg-zinc-50/40 px-3 py-3 transition hover:border-emerald-200 hover:bg-white hover:shadow-sm"
              >
                <span
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[13px] font-bold tracking-wide ring-1 ring-inset",
                    avatar
                  )}
                >
                  {initials(b.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[13px] font-semibold text-zinc-900 group-hover:text-emerald-800">
                      {b.name}
                    </p>
                    <span
                      className={cn(
                        "hidden shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset sm:inline",
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
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-zinc-300 ring-1 ring-inset ring-zinc-200 transition group-hover:bg-emerald-50 group-hover:text-emerald-600 group-hover:ring-emerald-200">
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
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

  const { recentClients, recentProspects, locationCount } = useMemo(() => {
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
    return {
      recentClients: clients,
      recentProspects: prospects,
      locationCount: active.length,
    };
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
            ? `${orgName.trim()} — pick a location, clear the queue, deliver the work.`
            : "Pick a location, clear the queue, deliver the work."
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
              {locationCount}
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              Clients + prospects in your org
            </p>
          </div>
        </div>
      ) : null}

      {/* Clients + prospects — full-width split */}
      <div className="grid gap-3 lg:grid-cols-2">
        <LocationRoster
          title="Clients"
          subtitle="Open a Dashboard and run the full toolset."
          mode="clients"
          accent="emerald"
          rows={recentClients}
          empty="No clients yet. Add a client to start recurring tracking."
          viewAllHref="/clients"
          hrefFor={(b) => `/businesses/${b.id}/overview`}
        />
        <LocationRoster
          title="Prospects"
          subtitle="Audit, report, then convert when they sign."
          mode="prospects"
          accent="sky"
          rows={recentProspects}
          empty="No prospects yet. Add a prospect to run your first audit."
          viewAllHref="/prospects"
          hrefFor={(b) => `/businesses/${b.id}/overview`}
        />
      </div>

      {loading ? (
        <ContentCard className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
          Loading your workspace…
        </ContentCard>
      ) : (
        <div className="space-y-3">
          {setup && !setup.complete ? <SetupProgressCard progress={setup} /> : null}

          <NextBestActionsPanel
            actions={actions}
            limit={5}
            viewAllHref="/onboarding"
          />

          {/* Active + attention — full-width halves */}
          <div className="grid gap-3 md:grid-cols-2">
            <ActiveWorkPanel
              scansRunning={scansRunning}
              schedulesUpcoming={schedulesUpcoming}
              draftReports={draftReports}
            />
            <NeedsAttentionPanel items={needsAttention} />
          </div>

          {/* Recent results — full width */}
          <RecentResultsPanel items={recent} />

          {/* Live ops only: scans running + reports due */}
          <div>
            <div className="mb-2">
              <h2 className={sectionTitleClass}>Live queue</h2>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                What is running now and which reports are due — completed work lives in Recent results.
              </p>
            </div>
            <WorkspaceQueueGrid queue={queue} />
          </div>
        </div>
      )}
    </ModulePage>
  );
}
