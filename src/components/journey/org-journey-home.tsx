"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, FileText, Loader2, Play, Target } from "lucide-react";
import { NextBestActionsPanel } from "@/components/journey/next-best-actions-panel";
import { SetupProgressCard } from "@/components/journey/setup-progress-card";
import {
  ActiveWorkPanel,
  NeedsAttentionPanel,
  RecentResultsPanel,
} from "@/components/journey/dashboard-work-panels";
import type { NextBestAction, SetupProgress } from "@/lib/journey/next-best-actions";
import type { WorkingQueueItem } from "@/lib/workspace/working-queue";
import { ModuleHeader, ModulePage, btnPrimary, btnSecondary } from "@/components/ui/design-system";
import { cn } from "@/lib/utils";

type RecentItem = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  kind?: string;
};

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

  return (
    <ModulePage wide>
      <ModuleHeader
        title={orgName ? `${orgName} workspace` : "Your workspace"}
        subtitle="What is happening now, what needs attention, and what to do next."
      />

      <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { href: "/businesses/new?as=prospect", label: "Add prospect", icon: Target },
          { href: "/businesses/new?as=client", label: "Add client", icon: Building2 },
          { href: "/scans/new", label: "Run scan", icon: Play },
          { href: "/reports", label: "Create report", icon: FileText },
        ].map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.href}
              href={a.href}
              className={cn(btnSecondary, "h-11 justify-start gap-2 px-3 text-[13px]")}
            >
              <Icon className="h-4 w-4 text-emerald-600" />
              {a.label}
            </Link>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
        <div className="space-y-4">
          {loading ? (
            <p className="flex items-center gap-2 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading your work queue…
            </p>
          ) : (
            <>
              <NextBestActionsPanel actions={actions} />
              <ActiveWorkPanel
                scansRunning={scansRunning}
                schedulesUpcoming={schedulesUpcoming}
                draftReports={draftReports}
              />
              <NeedsAttentionPanel items={needsAttention} />
              <RecentResultsPanel items={recent} />
            </>
          )}
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <h2 className="text-[13px] font-semibold text-zinc-900">Full work queue</h2>
            <p className="mt-1 text-[12px] text-zinc-500">
              Running scans, recovering jobs, reports due, and prospect follow-ups.
            </p>
            <Link href="/workspace" className={cn(btnPrimary, "mt-3 h-9 px-3 text-[13px]")}>
              Open Workspace
            </Link>
          </div>
        </div>
        <div className="space-y-4">
          {setup ? <SetupProgressCard progress={setup} /> : null}
          <div className="rounded-xl border border-zinc-200 bg-white p-4 text-[12px] text-zinc-600">
            <p className="font-semibold text-zinc-900">How this product is organized</p>
            <ul className="mt-2 space-y-1.5">
              <li>
                <strong>Nav</strong> — every tool stays visible
              </li>
              <li>
                <strong>Prospects / Clients</strong> — what is happening with this business
              </li>
              <li>
                <strong>Dashboard / Workspace</strong> — what to do next
              </li>
              <li>
                <strong>Reports</strong> — how you communicate value
              </li>
            </ul>
            <Link href="/onboarding" className="mt-3 inline-block text-emerald-700 hover:underline">
              Restart get-started guide
            </Link>
          </div>
        </div>
      </div>
    </ModulePage>
  );
}
