import type { DashboardFeaturedData } from "@/lib/overview/dashboard-featured-types";
import { DashboardAiVisibilityCard } from "@/components/overview/dashboard-ai-visibility-card";
import { DashboardLocalOpportunitiesCard } from "@/components/overview/dashboard-local-opportunities-card";
import { DashboardReviewPerformanceCard } from "@/components/overview/dashboard-review-performance-card";

export function DashboardFeaturedReports({
  businessId,
  data,
}: {
  businessId: string;
  data: DashboardFeaturedData;
}) {
  const showAi = data.ai.hasData;

  return (
    <section className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <DashboardReviewPerformanceCard businessId={businessId} data={data.review} />
        {showAi ? (
          <DashboardAiVisibilityCard businessId={businessId} data={data.ai} />
        ) : (
          <DashboardLocalOpportunitiesCard
            businessId={businessId}
            items={data.local.items}
            total={data.local.total}
            compact
          />
        )}
      </div>

      {showAi && (
        <DashboardLocalOpportunitiesCard
          businessId={businessId}
          items={data.local.items}
          total={data.local.total}
        />
      )}
    </section>
  );
}
