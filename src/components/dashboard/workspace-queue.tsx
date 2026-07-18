import Link from "next/link";
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

function QueueSection({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: WorkingQueueItem[];
}) {
  return (
    <ContentCard padding={false} className="overflow-hidden">
      <div className="border-b border-zinc-100 px-3.5 py-2.5">
        <h2 className={sectionTitleClass}>{title}</h2>
      </div>
      {items.length === 0 ? (
        <p className={cn(bodyClass, "px-3.5 py-3 text-zinc-500")}>{empty}</p>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="flex items-start justify-between gap-3 px-3.5 py-2.5 text-sm transition-colors hover:bg-zinc-50/80"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-zinc-900">{item.title}</span>
                  <span className="mt-0.5 block text-[12px] text-zinc-500">{item.subtitle}</span>
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
      )}
    </ContentCard>
  );
}

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
              Open clients
            </Link>
            <Link href="/dashboard" className={btnSecondary}>
              Open dashboard
            </Link>
          </div>
        }
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <QueueSection
          title="Scans running"
          empty="No scans in progress."
          items={queue.scansRunning}
        />
        <QueueSection
          title="Reports due"
          empty="No monthly reports flagged."
          items={queue.reportsDue}
        />
        <QueueSection
          title="Scans completed"
          empty="No recent completed scans."
          items={queue.scansCompleted}
        />
        <QueueSection
          title="Clients without a recent scan"
          empty="Every active client has a recent scan."
          items={queue.clientsNeedScan}
        />
        <QueueSection
          title="Scheduled scans coming up"
          empty="No scheduled campaign runs in the next week."
          items={queue.schedulesUpcoming}
        />
        <QueueSection
          title="Draft reports"
          empty="No draft reports waiting."
          items={queue.draftReports}
        />
        <QueueSection
          title="Prospect audits recently shared"
          empty="No prospect audits shared lately."
          items={queue.prospectAudits}
        />
      </div>
    </ModulePage>
  );
}
