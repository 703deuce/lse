import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import type { DashboardLocalOpportunity } from "@/lib/overview/dashboard-featured-types";
import { priorityClass } from "@/lib/overview/dashboard-featured-types";
import { cn } from "@/lib/utils";

export function DashboardLocalOpportunitiesCard({
  businessId,
  items,
  total,
  compact = false,
}: {
  businessId: string;
  items: DashboardLocalOpportunity[];
  total: number;
  compact?: boolean;
}) {
  const more = Math.max(0, total - items.length);
  const showCount = compact ? 3 : 4;

  return (
    <article className="rounded-xl border border-zinc-200/80 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Local Opportunities</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Sponsorships, chambers, vendor lists & community listings
          </p>
        </div>
        <Link
          href={`/businesses/${businessId}/trust`}
          className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700"
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
        <ul
          className={cn(
            "mt-2.5 divide-y divide-zinc-100",
            !compact && items.length > 2 && "lg:grid lg:grid-cols-2 lg:gap-x-4 lg:divide-y-0"
          )}
        >
          {items.slice(0, showCount).map((item) => (
            <li
              key={item.id}
              className={cn(
                "py-2 first:pt-0 last:pb-0",
                !compact && items.length > 2 && "lg:border-t lg:border-zinc-100 lg:py-2.5"
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px] font-semibold capitalize",
                        priorityClass(item.priority)
                      )}
                    >
                      {item.priority}
                    </span>
                    <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                      {item.opportunityType}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm font-semibold text-zinc-900">{item.title}</p>
                  {item.suggestedAction && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-zinc-600">{item.suggestedAction}</p>
                  )}
                  {item.evidenceSnippet && (
                    <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-zinc-500">
                      {item.evidenceSnippet}
                    </p>
                  )}
                </div>
                {item.domain && (
                  <span className="inline-flex max-w-[40%] shrink-0 items-center gap-1 truncate text-[11px] text-zinc-400">
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    {item.domain}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {more > 0 && (
        <p className="mt-2 text-xs font-medium text-zinc-500">+{more} more opportunities</p>
      )}
    </article>
  );
}
