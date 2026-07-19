"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  FileText,
  Loader2,
  Radar,
  Sparkles,
} from "lucide-react";
import type { WorkingQueueItem } from "@/lib/workspace/working-queue";
import {
  ContentCard,
  bodyClass,
  sectionTitleClass,
} from "@/components/ui/design-system";
import { cn } from "@/lib/utils";

const PREVIEW_LIMIT = 5;

function kindIcon(kind?: string): { icon: LucideIcon; wrap: string } {
  switch (kind) {
    case "scan_running":
    case "maps_scan":
      return { icon: Radar, wrap: "bg-emerald-50 text-emerald-600" };
    case "schedule_upcoming":
      return { icon: Clock, wrap: "bg-sky-50 text-sky-600" };
    case "draft_report":
    case "report":
    case "report_due":
      return { icon: FileText, wrap: "bg-violet-50 text-violet-600" };
    case "growth_audit":
      return { icon: Sparkles, wrap: "bg-amber-50 text-amber-600" };
    case "ai_visibility":
      return { icon: Sparkles, wrap: "bg-blue-50 text-blue-600" };
    case "client_needs_scan":
    case "prospect_shared":
      return { icon: AlertTriangle, wrap: "bg-amber-50 text-amber-600" };
    default:
      return { icon: Loader2, wrap: "bg-zinc-100 text-zinc-500" };
  }
}

function PanelShell({
  title,
  subtitle,
  icon: Icon,
  iconWrap,
  tone = "default",
  footer,
  children,
}: {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  iconWrap: string;
  tone?: "default" | "warning";
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <ContentCard
      padding={false}
      className={cn(
        "flex h-full flex-col overflow-hidden",
        tone === "warning" && "border-amber-200/80 bg-amber-50/30"
      )}
    >
      <div
        className={cn(
          "flex items-start gap-2.5 border-b px-3.5 py-2.5",
          tone === "warning" ? "border-amber-100" : "border-zinc-100"
        )}
      >
        <span
          className={cn(
            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
            iconWrap
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <h2
            className={cn(
              sectionTitleClass,
              tone === "warning" && "text-amber-950"
            )}
          >
            {title}
          </h2>
          <p
            className={cn(
              "mt-0.5 text-[11px] leading-snug",
              tone === "warning" ? "text-amber-900/70" : "text-zinc-500"
            )}
          >
            {subtitle}
          </p>
        </div>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
      {footer}
    </ContentCard>
  );
}

function ItemList({
  items,
  empty,
  limit = PREVIEW_LIMIT,
  viewAllHref,
  viewAllLabel,
}: {
  items: Array<{
    id: string;
    title: string;
    subtitle: string;
    href: string;
    kind?: string;
  }>;
  empty: string;
  limit?: number;
  viewAllHref?: string;
  viewAllLabel?: string;
}) {
  if (!items.length) {
    return <p className={cn(bodyClass, "px-3.5 py-3.5 text-zinc-500")}>{empty}</p>;
  }

  const visible = items.slice(0, limit);
  const remaining = items.length - visible.length;

  return (
    <>
      <ul className="divide-y divide-zinc-100">
        {visible.map((item) => {
          const meta = kindIcon(item.kind);
          const RowIcon = meta.icon;
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                className="group flex items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-zinc-50/80"
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ring-black/5",
                    meta.wrap
                  )}
                >
                  <RowIcon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-zinc-900">
                    {item.title}
                  </p>
                  <p className="truncate text-[11px] text-zinc-500">{item.subtitle}</p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-300 transition group-hover:text-emerald-600" />
              </Link>
            </li>
          );
        })}
      </ul>
      {remaining > 0 && viewAllHref ? (
        <div className="border-t border-zinc-100 px-3.5 py-2">
          <Link
            href={viewAllHref}
            className="text-[12px] font-medium text-emerald-700 hover:text-emerald-800"
          >
            {viewAllLabel ?? `View all (${items.length})`}
          </Link>
        </div>
      ) : remaining > 0 ? (
        <p className="border-t border-zinc-100 px-3.5 py-2 text-[11px] text-zinc-400">
          +{remaining} more
        </p>
      ) : null}
    </>
  );
}

export function ActiveWorkPanel({
  scansRunning,
  schedulesUpcoming,
  draftReports,
}: {
  scansRunning: WorkingQueueItem[];
  schedulesUpcoming: WorkingQueueItem[];
  draftReports: WorkingQueueItem[];
}) {
  const items = [
    ...scansRunning.map((i) => ({
      ...i,
      kind: i.kind ?? "scan_running",
      subtitle: `Active · ${i.subtitle}`,
    })),
    ...schedulesUpcoming.map((i) => ({
      ...i,
      kind: i.kind ?? "schedule_upcoming",
      subtitle: `Upcoming · ${i.subtitle}`,
    })),
    ...draftReports.map((i) => ({
      ...i,
      kind: i.kind ?? "draft_report",
      subtitle: `Draft · ${i.subtitle}`,
    })),
  ];

  return (
    <PanelShell
      title="Active work"
      subtitle="Scans running, schedules due, and drafts in progress."
      icon={Radar}
      iconWrap="bg-emerald-50 text-emerald-600"
    >
      <ItemList
        items={items}
        empty="Nothing running right now."
        limit={PREVIEW_LIMIT}
        viewAllHref="/scans"
        viewAllLabel={`View all (${items.length})`}
      />
    </PanelShell>
  );
}

export function NeedsAttentionPanel({ items }: { items: WorkingQueueItem[] }) {
  return (
    <PanelShell
      title="Needs attention"
      subtitle="Clients overdue for scans, drafts waiting, or prospect follow-ups."
      icon={AlertTriangle}
      iconWrap="bg-amber-100 text-amber-700"
      tone="warning"
    >
      <ItemList
        items={items.map((i) => ({ ...i, kind: i.kind }))}
        empty="You're caught up — no urgent follow-ups."
        limit={PREVIEW_LIMIT}
        viewAllHref="/clients"
        viewAllLabel={`View all (${items.length})`}
      />
    </PanelShell>
  );
}

export function RecentResultsPanel({
  items,
}: {
  items: Array<{
    id: string;
    title: string;
    subtitle: string;
    href: string;
    kind?: string;
  }>;
}) {
  return (
    <PanelShell
      title="Recent results"
      subtitle="Completed scans, audits, AI checks, and report activity."
      icon={Sparkles}
      iconWrap="bg-violet-50 text-violet-600"
    >
      <ItemList
        items={items}
        empty="Run a scan or audit to see results here."
        limit={PREVIEW_LIMIT}
        viewAllHref="/scans"
        viewAllLabel={`View all (${items.length})`}
      />
    </PanelShell>
  );
}

/** Full-width half panels: scans running | reports due */
export function QueueHalfPanel({
  title,
  subtitle,
  icon,
  iconWrap,
  items,
  empty,
  viewAllHref,
}: {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  iconWrap: string;
  items: WorkingQueueItem[];
  empty: string;
  viewAllHref: string;
}) {
  return (
    <PanelShell title={title} subtitle={subtitle} icon={icon} iconWrap={iconWrap}>
      <ItemList
        items={items.map((i) => ({ ...i, kind: i.kind }))}
        empty={empty}
        limit={PREVIEW_LIMIT}
        viewAllHref={viewAllHref}
        viewAllLabel={`View all (${items.length})`}
      />
    </PanelShell>
  );
}
