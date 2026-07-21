import type { DashboardFeaturedData } from "@/lib/overview/dashboard-featured-types";
import { DashboardAiVisibilityCard } from "@/components/overview/dashboard-ai-visibility-card";
import { DashboardLocalOpportunitiesCard } from "@/components/overview/dashboard-local-opportunities-card";

/**
 * Maps product featured strip — AI visibility + local opportunities.
 * Review Performance belongs to the separate Reputation product and is omitted.
 */
export function DashboardFeaturedReports({
  businessId,
  data,
}: {
  businessId: string;
  data: DashboardFeaturedData;
}) {
  const showAi = data.ai.hasData;
  const showLocal = data.local.total > 0 || data.local.items.length > 0;

  if (!showAi && !showLocal) return null;

  return (
    <section className={showAi && showLocal ? "grid gap-3 lg:grid-cols-2" : "grid gap-3"}>
      {showAi ? (
        <DashboardAiVisibilityCard businessId={businessId} data={data.ai} />
      ) : null}
      {showLocal ? (
        <DashboardLocalOpportunitiesCard
          businessId={businessId}
          items={data.local.items}
          total={data.local.total}
          compact={!showAi}
        />
      ) : null}
    </section>
  );
}
