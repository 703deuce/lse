import Link from "next/link";
import type { WorkingQueue, WorkingQueueItem } from "@/lib/workspace/working-queue";
import { FREELANCER_MAPS_PRODUCT } from "@/lib/product/freelancer-maps";

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
    <section className="rounded-xl border border-zinc-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">{empty}</p>
      ) : (
        <ul className="mt-3 divide-y divide-zinc-100">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="flex items-start justify-between gap-3 py-2.5 text-sm hover:bg-zinc-50/80"
              >
                <span>
                  <span className="font-medium text-zinc-900">{item.title}</span>
                  <span className="mt-0.5 block text-xs text-zinc-500">{item.subtitle}</span>
                </span>
                {item.at ? (
                  <span className="shrink-0 text-[11px] text-zinc-400">
                    {new Date(item.at).toLocaleDateString()}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function WorkingQueueDashboard({
  queue,
  orgName,
}: {
  queue: WorkingQueue;
  orgName?: string | null;
}) {
  const hasWork =
    queue.scansRunning.length +
      queue.reportsDue.length +
      queue.draftReports.length +
      queue.clientsNeedScan.length +
      queue.schedulesUpcoming.length +
      queue.prospectAudits.length >
    0;

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
          {FREELANCER_MAPS_PRODUCT.name}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
          {orgName?.trim() || "Your workspace"}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-600">
          {FREELANCER_MAPS_PRODUCT.tagline}
        </p>
        {!hasWork ? (
          <p className="mt-3 text-sm text-zinc-500">
            Nothing waiting right now. Add a prospect or open a client to run scans and
            deliver reports.
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/prospects"
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Audit a prospect
          </Link>
          <Link
            href="/clients"
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Open clients
          </Link>
          <Link
            href="/branding"
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Report branding
          </Link>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
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
    </div>
  );
}
