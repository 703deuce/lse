"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Calendar,
  Eye,
  FileText,
  Grid3X3,
  Loader2,
  MessageSquare,
  Plus,
  Radar,
  Target,
} from "lucide-react";
import { CancelActiveScansButton } from "@/components/scan/cancel-active-scans-button";
import type { NextBestAction, SetupProgress } from "@/lib/journey/next-best-actions";
import type { WorkingQueue, WorkingQueueItem } from "@/lib/workspace/working-queue";
import { MockMetricCard, MockPageHeader, MockTableShell, mock } from "@/components/mockup/ui";
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
  archived_at?: string | null;
  created_at?: string | null;
};

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

function priorityClass(p?: number) {
  if (p != null && p <= 20) return "bg-[#FEF3F2] text-[#B42318]";
  if (p != null && p <= 35) return "bg-[#FFFAEB] text-[#B54708]";
  return "bg-[#EFF8FF] text-[#175CD3]";
}

function priorityLabel(p?: number) {
  if (p != null && p <= 20) return "High";
  if (p != null && p <= 35) return "Medium";
  return "Low";
}

function Donut({ value }: { value: number }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const offset = c - (pct / 100) * c;
  return (
    <div className="relative h-[140px] w-[140px] shrink-0">
      <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#EEF2F6" strokeWidth="12" />
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke="#137752"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-3xl font-bold text-[#101828]">{pct}</p>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#98A2B3]">Score</p>
      </div>
    </div>
  );
}

/** Main freelancer home — Workspace matching product mockups. */
export function OrgJourneyHome({ orgName }: { orgName?: string | null }) {
  const [actions, setActions] = useState<NextBestAction[]>([]);
  const [setup, setSetup] = useState<SetupProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<WorkingQueue>(emptyQueue);
  const [scansRunning, setScansRunning] = useState<WorkingQueueItem[]>([]);
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
          setDraftReports(queueJson.activeWork?.draftReports ?? []);
          setNeedsAttention(queueJson.needsAttention ?? []);
          setRecent(queueJson.recent ?? []);
        }
        const bizJson = await bizRes.json();
        if (bizRes.ok) setBusinesses((bizJson.businesses as BizRow[]) ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const { clients, prospects, locationCount, healthScore } = useMemo(() => {
    const active = businesses.filter((b) => !b.archived_at);
    const prospectsList = active.filter(
      (b) => b.account_type === "prospect" || b.is_tracked === false
    );
    const clientsList = active.filter(
      (b) => b.account_type !== "prospect" && b.is_tracked !== false
    );
    let score = 40;
    if (clientsList.length) score += 15;
    if (recent.length) score += 10;
    if (setup?.complete) score += 15;
    if (!needsAttention.length) score += 10;
    if (scansRunning.length) score += 5;
    return {
      clients: clientsList.slice(0, 4),
      prospects: prospectsList.slice(0, 2),
      locationCount: active.length,
      healthScore: Math.min(98, score),
    };
  }, [businesses, recent.length, setup?.complete, needsAttention.length, scansRunning.length]);

  const scanRows = recent.filter((r) => (r.kind ?? "").includes("scan") || r.href.includes("/grid/"));
  const displayScans = (scanRows.length ? scanRows : recent).slice(0, 6);

  return (
    <div className={mock.page}>
      <MockPageHeader
        title="Workspace"
        subtitle={
          orgName?.trim()
            ? `Overview of ${orgName.trim()} SEO performance and growth opportunities.`
            : "A complete overview of your SEO performance and growth opportunities."
        }
        actions={
          <>
            <Link href="/businesses/new?as=client" className={mock.btnPrimary}>
              <Plus className="h-4 w-4" />
              Create New
            </Link>
            <button type="button" className={mock.btnSecondary}>
              <Calendar className="h-4 w-4" />
              Filter Dates
            </button>
          </>
        }
      />

      {loading ? (
        <div className={cn(mock.cardPad, "flex items-center gap-2 text-sm text-[#667085]")}>
          <Loader2 className="h-4 w-4 animate-spin text-[#137752]" />
          Loading your workspace…
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MockMetricCard
              label="Local SEO Score"
              value={healthScore}
              icon={Target}
              hint="Composite health"
            />
            <MockMetricCard
              label="Active Maps Scans"
              value={scansRunning.length}
              icon={Radar}
              iconClassName="bg-[#EFF8FF] text-[#175CD3]"
              hint="Running now"
            />
            <MockMetricCard
              label="Locations"
              value={locationCount}
              icon={Building2}
              iconClassName="bg-[#FEF6EE] text-[#C4320A]"
              hint={`${clients.length} clients · ${prospects.length} prospects shown`}
            />
            <MockMetricCard
              label="Needs Attention"
              value={needsAttention.length}
              icon={MessageSquare}
              iconClassName="bg-[#F4F3FF] text-[#5925DC]"
              hint="Follow-ups & drafts"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
            <div className={cn(mock.card, "p-5")}>
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <Donut value={healthScore} />
                <div className="min-w-0 flex-1 space-y-3">
                  <div>
                    <h2 className="text-base font-semibold text-[#101828]">Health Score</h2>
                    <p className="mt-0.5 text-xs text-[#667085]">Overall SEO readiness for your book</p>
                  </div>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-[#344054]">
                        <span className="h-2 w-2 rounded-full bg-[#12B76A]" />
                        Maps Ranking
                      </span>
                      <span className="text-xs font-semibold text-[#027A48]">
                        {recent.length ? "Tracked" : "Needs baseline"}
                      </span>
                    </li>
                    <li className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-[#344054]">
                        <span className="h-2 w-2 rounded-full bg-[#F79009]" />
                        Citations / Trust
                      </span>
                      <span className="text-xs font-medium text-[#667085]">Open Local Trust</span>
                    </li>
                    <li className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-[#344054]">
                        <span className="h-2 w-2 rounded-full bg-[#F04438]" />
                        AI Visibility
                      </span>
                      <span className="text-xs font-medium text-[#B42318]">
                        {needsAttention.length ? "Needs attention" : "Low"}
                      </span>
                    </li>
                    <li className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-[#344054]">
                        <span className="h-2 w-2 rounded-full bg-[#175CD3]" />
                        Backlink Gap
                      </span>
                      <Link href="/tools" className={mock.link}>
                        Run scan now
                      </Link>
                    </li>
                  </ul>
                  <Link href="/clients" className={cn(mock.link, "text-xs")}>
                    See full audit report →
                  </Link>
                </div>
              </div>
            </div>

            <div className={cn(mock.card, "overflow-hidden")}>
              <div className="flex items-center justify-between border-b border-[#F2F4F7] px-4 py-3">
                <h2 className="text-base font-semibold text-[#101828]">Recommended Next Actions</h2>
                <span className="rounded-full bg-[#FEF3F2] px-2 py-0.5 text-[11px] font-semibold text-[#B42318]">
                  {actions.length} Actionable
                </span>
              </div>
              <ul className="divide-y divide-[#F2F4F7]">
                {(actions.length ? actions : []).slice(0, 4).map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#101828]">{a.title}</p>
                      {a.description ? (
                        <p className="mt-0.5 line-clamp-1 text-xs text-[#667085]">{a.description}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={cn(
                          "rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase",
                          priorityClass(a.priority)
                        )}
                      >
                        {priorityLabel(a.priority)}
                      </span>
                      <Link href={a.href} className={mock.link}>
                        View
                      </Link>
                    </div>
                  </li>
                ))}
                {!actions.length ? (
                  <li className="px-4 py-8 text-center text-sm text-[#667085]">
                    You&apos;re caught up — no urgent actions right now.
                  </li>
                ) : null}
              </ul>
              {actions.length > 4 ? (
                <div className="border-t border-[#F2F4F7] px-4 py-2.5 text-center">
                  <Link href="/workspace" className={mock.link}>
                    See all {actions.length} tasks
                  </Link>
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
            <MockTableShell
              title="Recent Maps Scans"
              subtitle="Latest grid results across your book"
              actions={
                scansRunning.length > 0 || queue.scansRunning.length > 0 ? (
                  <CancelActiveScansButton label="Cancel all" />
                ) : (
                  <Link href="/scans" className={mock.link}>
                    View all
                  </Link>
                )
              }
            >
              <table className="min-w-full">
                <thead>
                  <tr className={mock.tableHead}>
                    <th className="px-4 py-3">Keyword</th>
                    <th className="px-4 py-3">City</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2F4F7]">
                  {displayScans.map((row) => (
                    <tr key={row.id} className="hover:bg-[#F9FAFB]">
                      <td className={cn(mock.tableCell, "font-semibold text-[#101828]")}>
                        {row.title}
                      </td>
                      <td className={cn(mock.tableCell, "text-[#667085]")}>{row.subtitle || "—"}</td>
                      <td className={mock.tableCell}>
                        <span className={mock.badgeGreen}>Ready</span>
                      </td>
                      <td className={cn(mock.tableCell, "text-right")}>
                        <Link href={row.href} className={mock.link}>
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {!displayScans.length ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-sm text-[#667085]">
                        No recent scans yet.{" "}
                        <Link href="/scans/new" className={mock.link}>
                          Run a scan
                        </Link>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
              <div className="border-t border-[#F2F4F7] px-4 py-3 text-center">
                <Link href="/scans" className={cn(mock.btnSecondary, "h-9 px-4 text-xs")}>
                  <Grid3X3 className="h-3.5 w-3.5" />
                  View all map scans
                </Link>
              </div>
            </MockTableShell>

            <div className="space-y-4">
              <div className={cn(mock.card, "overflow-hidden")}>
                <div className="flex items-center justify-between border-b border-[#F2F4F7] px-4 py-3">
                  <h2 className="text-base font-semibold text-[#101828]">Your Clients</h2>
                  <Link href="/clients" className={mock.link}>
                    View all
                  </Link>
                </div>
                <ul className="divide-y divide-[#F2F4F7]">
                  {clients.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ECFDF3] text-xs font-bold text-[#137752]">
                          {c.name.slice(0, 2).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <Link
                            href={`/businesses/${c.id}/overview`}
                            className="block truncate text-sm font-semibold text-[#101828] hover:text-[#137752]"
                          >
                            {c.name}
                          </Link>
                          <p className="truncate text-[11px] text-[#667085]">
                            {c.primary_category || c.scan_center_label || "Client"}
                          </p>
                        </div>
                      </div>
                      <span className={mock.badgeGreen}>Active</span>
                    </li>
                  ))}
                  {!clients.length ? (
                    <li className="px-4 py-6 text-center text-sm text-[#667085]">
                      No clients yet.{" "}
                      <Link href="/businesses/new?as=client" className={mock.link}>
                        Add one
                      </Link>
                    </li>
                  ) : null}
                </ul>
              </div>

              <div className={cn(mock.cardPad)}>
                <h2 className="text-base font-semibold text-[#101828]">Statistics</h2>
                <dl className="mt-3 grid grid-cols-2 gap-3">
                  {[
                    ["Projects", locationCount],
                    ["Scans", recent.length],
                    ["Drafts", draftReports.length],
                    ["Attention", needsAttention.length],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-lg bg-[#F9FAFB] px-3 py-2.5">
                      <dt className="text-[11px] font-medium text-[#667085]">{label}</dt>
                      <dd className="mt-0.5 text-lg font-bold tabular-nums text-[#101828]">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </div>

          <div className={cn(mock.card, "flex flex-wrap items-center gap-2 px-3 py-2.5")}>
            {[
              { href: "/scans/new", label: "New Scan", icon: Radar },
              { href: "/reports", label: "Generate Report", icon: FileText },
              { href: "/clients", label: "Clients", icon: Building2 },
              { href: "/prospects", label: "Prospects", icon: Eye },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-[#475467] hover:bg-[#F2F4F7]"
                >
                  <Icon className="h-3.5 w-3.5 text-[#137752]" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
