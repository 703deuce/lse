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

  return (
    <section className="space-y-2.5">
      <div className="grid gap-2 lg:grid-cols-2">
        {showAi ? (
          <DashboardAiVisibilityCard businessId={businessId} data={data.ai} />
        ) : (
          <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 px-4 py-5">
            <p className="text-sm font-semibold text-zinc-900">AI Visibility</p>
            <p className="mt-1 text-xs text-zinc-500">
              Optional mention tracking for client reports. Run prompts when you need them —
              not required for Maps rank tracking.
            </p>
            <a
              href={`/businesses/${businessId}/ai-visibility`}
              className="mt-3 inline-block text-xs font-medium text-emerald-700 hover:underline"
            >
              Open AI Visibility
            </a>
          </div>
        )}
        <DashboardLocalOpportunitiesCard
          businessId={businessId}
          items={data.local.items}
          total={data.local.total}
          compact={!showAi}
        />
      </div>
    </section>
  );
}
