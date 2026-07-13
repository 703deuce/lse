import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { DashboardLocalOpportunity } from "@/lib/overview/load-dashboard-featured";

export function DashboardLocalOpportunitiesCard({
  businessId,
  items,
  total,
}: {
  businessId: string;
  items: DashboardLocalOpportunity[];
  total: number;
}) {
  const more = Math.max(0, total - items.length);

  return (
    <article className="rounded-xl border border-zinc-200/80 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Local Opportunities</h2>
          <p className="mt-0.5 text-xs text-zinc-500">Recent sponsorships & community listings</p>
        </div>
        <Link
          href={`/businesses/${businessId}/trust`}
          className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700"
        >
          View all
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="mt-3 text-xs text-zinc-500">
          Run Local Trust to discover sponsorship and directory opportunities.
        </p>
      ) : (
        <ul className="mt-2.5 space-y-1.5">
          {items.slice(0, 3).map((item) => (
            <li
              key={item.id}
              className="truncate rounded-md border border-zinc-100 bg-zinc-50/80 px-2.5 py-1.5 text-xs font-medium text-zinc-800"
            >
              {item.title}
            </li>
          ))}
          {more > 0 && (
            <li className="px-1 text-xs text-zinc-500">+{more} more</li>
          )}
        </ul>
      )}
    </article>
  );
}
