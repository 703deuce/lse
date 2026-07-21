import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import type { DashboardLocalOpportunity } from "@/lib/overview/dashboard-featured-types";
import { priorityClass } from "@/lib/overview/dashboard-featured-types";
import {
  dashboardAccentLink,
  dashboardBadge,
  dashboardBody,
  dashboardCardMeta,
  dashboardCardTitle,
  dashboardMicro,
  dashboardSectionLabel,
} from "@/components/overview/dashboard-ui";
import { ContentCard } from "@/components/ui/design-system";
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
    <ContentCard>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className={dashboardCardTitle}>Local Opportunities</h2>
          <p className={cn(dashboardCardMeta, "mt-0.5")}>
            Sponsorships, chambers, and community listings
          </p>
        </div>
        <Link
          href={`/businesses/${businessId}/trust`}
          className={cn(dashboardAccentLink, "inline-flex items-center gap-1")}
        >
          View all
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {items.length === 0 ? (
        <p className={cn(dashboardBody, "mt-3 text-zinc-500")}>
          Run Local Trust to discover sponsorship and directory opportunities.
        </p>
      ) : (
        <ul
          className={cn(
            "mt-3 divide-y divide-zinc-100",
            !compact && items.length > 2 && "lg:grid lg:grid-cols-2 lg:gap-x-5 lg:divide-y-0"
          )}
        >
          {items.slice(0, showCount).map((item) => (
            <li
              key={item.id}
              className={cn(
                "py-2.5 first:pt-0 last:pb-0",
                !compact && items.length > 2 && "lg:border-t lg:border-zinc-100 lg:py-3"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={cn(dashboardBadge, "capitalize", priorityClass(item.priority))}>
                      {item.priority}
                    </span>
                    <span className={dashboardSectionLabel}>{item.opportunityType}</span>
                  </div>
                  <p className="mt-1 text-[13px] font-semibold leading-snug text-zinc-900">
                    {item.title}
                  </p>
                  {item.suggestedAction && (
                    <p className={cn(dashboardBody, "mt-0.5 line-clamp-2 text-[12px] text-zinc-600")}>
                      {item.suggestedAction}
                    </p>
                  )}
                  {item.evidenceSnippet && (
                    <p className={cn(dashboardMicro, "mt-0.5 line-clamp-2 text-zinc-500")}>
                      {item.evidenceSnippet}
                    </p>
                  )}
                </div>
                {item.domain && (
                  <span className="inline-flex max-w-[38%] shrink-0 items-center gap-1 truncate text-[10px] text-zinc-400">
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
        <p className={cn(dashboardMicro, "mt-2.5 font-medium text-zinc-500")}>
          +{more} more opportunities
        </p>
      )}
    </ContentCard>
  );
}
