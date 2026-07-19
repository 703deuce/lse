"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Compass,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Loader2,
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
import type { NextBestAction, SetupProgress } from "@/lib/journey/next-best-actions";
import type { WorkingQueueItem } from "@/lib/workspace/working-queue";
import {
  ContentCard,
  ModuleHeader,
  ModulePage,
  btnPrimary,
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

export function OrgJourneyHome({ orgName }: { orgName?: string | null }) {
  const [actions, setActions] = useState<NextBestAction[]>([]);
  const [setup, setSetup] = useState<SetupProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [scansRunning, setScansRunning] = useState<WorkingQueueItem[]>([]);
  const [schedulesUpcoming, setSchedulesUpcoming] = useState<WorkingQueueItem[]>([]);
  const [draftReports, setDraftReports] = useState<WorkingQueueItem[]>([]);
  const [needsAttention, setNeedsAttention] = useState<WorkingQueueItem[]>([]);
  const [recent, setRecent] = useState<RecentItem[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const [nbaRes, queueRes] = await Promise.all([
          fetch("/api/journey/next-actions?setup=1"),
          fetch("/api/journey/work-queue"),
        ]);
        const nbaJson = await nbaRes.json();
        if (nbaRes.ok) {
          setActions(nbaJson.actions ?? []);
          setSetup(nbaJson.setup ?? null);
        }
        const queueJson = await queueRes.json();
        if (queueRes.ok) {
          setScansRunning(queueJson.activeWork?.scansRunning ?? []);
          setSchedulesUpcoming(queueJson.activeWork?.schedulesUpcoming ?? []);
          setDraftReports(queueJson.activeWork?.draftReports ?? []);
          setNeedsAttention(queueJson.needsAttention ?? []);
          setRecent(queueJson.recent ?? []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const activeCount =
    scansRunning.length + schedulesUpcoming.length + draftReports.length;
  const attentionCount = needsAttention.length;

  return (
    <ModulePage wide>
      <ModuleHeader
        icon={LayoutDashboard}
        title={orgName ? `${orgName} workspace` : "Your workspace"}
        subtitle="What is happening now, what needs attention, and what to do next."
        actions={
          <Link href="/workspace" className={cn(btnPrimary, "h-9 px-3 text-[13px]")}>
            <FolderKanban className="h-3.5 w-3.5" />
            Open Workspace
          </Link>
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
            <p className={cardLabelClass}>Recent results</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-zinc-900">
              {recent.length}
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              Scans, audits, AI, reports
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
        <div className="space-y-3">
          {loading ? (
            <ContentCard className="flex items-center gap-2 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
              Loading your work queue…
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
            </>
          )}
        </div>

        <div className="space-y-3">
          {setup ? <SetupProgressCard progress={setup} /> : null}

          <ContentCard padding={false} className="overflow-hidden">
            <div className="flex items-start gap-2.5 border-b border-zinc-100 px-3.5 py-2.5">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
                <Compass className="h-3.5 w-3.5" />
              </span>
              <div>
                <h2 className={sectionTitleClass}>How this product works</h2>
                <p className="mt-0.5 text-[11px] text-zinc-500">
                  Keep every tool visible — follow the journey.
                </p>
              </div>
            </div>
            <ul className="divide-y divide-zinc-100 px-3.5">
              {[
                { label: "Nav", text: "every tool stays visible" },
                { label: "Prospects / Clients", text: "what is happening with this business" },
                { label: "Dashboard / Workspace", text: "what to do next" },
                { label: "Reports", text: "how you communicate value" },
              ].map((row) => (
                <li key={row.label} className="py-2.5 text-[12px] leading-snug text-zinc-600">
                  <span className="font-semibold text-zinc-900">{row.label}</span>
                  {" — "}
                  {row.text}
                </li>
              ))}
            </ul>
            <div className="border-t border-zinc-100 px-3.5 py-2.5">
              <Link
                href="/onboarding"
                className={cn(btnSecondary, "h-8 w-full justify-center px-3 text-[12px]")}
              >
                Restart get-started guide
              </Link>
            </div>
          </ContentCard>
        </div>
      </div>
    </ModulePage>
  );
}
