import Link from "next/link";
import { FileText, Radar } from "lucide-react";
import type { WorkingQueue, WorkingQueueItem } from "@/lib/workspace/working-queue";
import {
  ModuleHeader,
  ModulePage,
  ContentCard,
  btnPrimary,
  btnSecondary,
  sectionTitleClass,
  bodyClass,
} from "@/components/ui/design-system";
import { cn } from "@/lib/utils";

const PREVIEW_LIMIT = 5;

function QueueSection({
  title,
  empty,
  items,
  viewAllHref,
}: {
  title: string;
  empty: string;
  items: WorkingQueueItem[];
  viewAllHref: string;
}) {
  const visible = items.slice(0, PREVIEW_LIMIT);
  const remaining = items.length - visible.length;

  return (
    <ContentCard padding={false} className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-3.5 py-2.5">
        <h2 className={sectionTitleClass}>{title}</h2>
        {items.length > 0 ? (
          <span className="text-[11px] tabular-nums text-zinc-400">{items.length}</span>
        ) : null}
      </div>
      {items.length === 0 ? (
        <p className={cn(bodyClass, "px-3.5 py-3 text-zinc-500")}>{empty}</p>
      ) : (
        <>
          <ul className="divide-y divide-zinc-100">
            {visible.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="flex items-start justify-between gap-3 px-3.5 py-2.5 text-sm transition-colors hover:bg-zinc-50/80"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-zinc-900">
                      {item.title}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-zinc-500">
                      {item.subtitle}
                    </span>
                  </span>
                  {item.at ? (
                    <span className="shrink-0 text-[11px] tabular-nums text-zinc-400">
                      {new Date(item.at).toLocaleDateString()}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
          {remaining > 0 ? (
            <div className="mt-auto border-t border-zinc-100 px-3.5 py-2">
              <Link
                href={viewAllHref}
                className="text-[12px] font-medium text-emerald-700 hover:text-emerald-800"
              >
                View all ({items.length})
              </Link>
            </div>
          ) : null}
        </>
      )}
    </ContentCard>
  );
}

/**
 * Workspace queue — only live operational buckets.
 * Scans completed / clients without scan live under Recent results / Needs attention.
 */
export function WorkspaceQueueGrid({ queue }: { queue: WorkingQueue }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <QueueSection
        title="Scans running"
        empty="No scans in progress."
        items={queue.scansRunning}
        viewAllHref="/scans"
      />
      <QueueSection
        title="Reports due"
        empty="No monthly reports flagged."
        items={queue.reportsDue}
        viewAllHref="/reports"
      />
    </div>
  );
}

/** @deprecated Prefer embedding WorkspaceQueueGrid on the main Workspace home. */
export function WorkspaceQueue({
  queue,
  orgName,
}: {
  queue: WorkingQueue;
  orgName?: string | null;
}) {
  return (
    <ModulePage wide>
      <ModuleHeader
        title="Workspace"
        subtitle={
          orgName?.trim()
            ? `${orgName.trim()} — scans running, reports due, and prospect follow-ups across your clients.`
            : "Scans running, reports due, and prospect follow-ups across your clients."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/prospects" className={btnPrimary}>
              Audit a prospect
            </Link>
            <Link href="/clients" className={btnSecondary}>
              Clients
            </Link>
          </div>
        }
        icon={Radar}
      />
      <WorkspaceQueueGrid queue={queue} />
      {/* Keep draft reports accessible without crowding the home */}
      {queue.draftReports.length > 0 ? (
        <ContentCard padding={false} className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-zinc-100 px-3.5 py-2.5">
            <FileText className="h-3.5 w-3.5 text-violet-600" />
            <h2 className={sectionTitleClass}>Draft reports</h2>
          </div>
          <ul className="divide-y divide-zinc-100">
            {queue.draftReports.slice(0, PREVIEW_LIMIT).map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="block px-3.5 py-2.5 text-sm hover:bg-zinc-50/80"
                >
                  <span className="font-medium text-zinc-900">{item.title}</span>
                  <span className="mt-0.5 block text-[12px] text-zinc-500">
                    {item.subtitle}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </ContentCard>
      ) : null}
    </ModulePage>
  );
}
