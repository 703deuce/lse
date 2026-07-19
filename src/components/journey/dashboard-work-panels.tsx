"use client";

import Link from "next/link";
import type { WorkingQueueItem } from "@/lib/workspace/working-queue";

function ItemList({
  items,
  empty,
}: {
  items: Array<{ id: string; title: string; subtitle: string; href: string }>;
  empty: string;
}) {
  if (!items.length) {
    return <p className="text-[12px] text-zinc-500">{empty}</p>;
  }
  return (
    <ul className="divide-y divide-zinc-100">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={item.href}
            className="flex items-start justify-between gap-2 py-2 hover:bg-zinc-50/80"
          >
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-zinc-900">{item.title}</p>
              <p className="truncate text-[11px] text-zinc-500">{item.subtitle}</p>
            </div>
            <span className="shrink-0 text-[11px] font-medium text-emerald-700">Open</span>
          </Link>
        </li>
      ))}
    </ul>
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
    ...scansRunning.map((i) => ({ ...i, subtitle: `Active · ${i.subtitle}` })),
    ...schedulesUpcoming.slice(0, 4).map((i) => ({ ...i, subtitle: `Upcoming · ${i.subtitle}` })),
    ...draftReports.slice(0, 3).map((i) => ({ ...i, subtitle: `Draft · ${i.subtitle}` })),
  ].slice(0, 8);

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4">
      <h2 className="text-[13px] font-semibold text-zinc-900">Active work</h2>
      <p className="mt-0.5 text-[11px] text-zinc-500">
        Scans running, schedules due, and drafts in progress.
      </p>
      <div className="mt-2">
        <ItemList items={items} empty="Nothing running right now." />
      </div>
    </section>
  );
}

export function NeedsAttentionPanel({ items }: { items: WorkingQueueItem[] }) {
  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
      <h2 className="text-[13px] font-semibold text-amber-950">Needs attention</h2>
      <p className="mt-0.5 text-[11px] text-amber-900/70">
        Clients overdue for scans, drafts waiting, or prospect follow-ups.
      </p>
      <div className="mt-2">
        <ItemList
          items={items.slice(0, 8)}
          empty="You're caught up — no urgent follow-ups."
        />
      </div>
    </section>
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
    <section className="rounded-xl border border-zinc-200 bg-white p-4">
      <h2 className="text-[13px] font-semibold text-zinc-900">Recent results</h2>
      <p className="mt-0.5 text-[11px] text-zinc-500">
        Completed scans, audits, AI checks, and report activity.
      </p>
      <div className="mt-2">
        <ItemList items={items} empty="Run a scan or audit to see results here." />
      </div>
    </section>
  );
}
