import { requireAuth } from "@/lib/auth/context";
import {
  getBusiness,
  getLatestScan,
  getBusinessKeywords,
  getLatestAudit,
  getActionPlanForAudit,
} from "@/lib/db/queries";
import { notFound } from "next/navigation";
import { loadLatestMomentumRun } from "@/lib/reviews/momentum-engine";
import { loadLatestGrowthAudit } from "@/lib/growth-audit/engine";
import { CitationHealthOverviewCard } from "@/components/citations/citation-health-overview";
import { ReputationHealthOverviewCard } from "@/components/reputation/reputation-health-overview";
import { ReviewRequestsOverviewCard } from "@/components/reputation/review-requests-overview";
import { BacklinkGapOverviewCard } from "@/components/backlink-gap/backlink-gap-overview";
import { KeywordVisibilityOverviewCard } from "@/components/keyword-tracker/keyword-overview";
import { GrowthAuditOverviewCard } from "@/components/growth-audit/growth-audit-overview-card";
import { ReviewMomentumOverviewSection } from "@/components/reviews/review-momentum-overview-section";
import { OverviewPageHeader } from "@/components/overview/overview-header";
import {
  OverviewCoreScores,
  OverviewAuditSnapshot,
  OverviewRecommendedActions,
  OverviewFooterCta,
} from "@/components/overview/overview-sections";
import { ModulePage } from "@/components/ui/design-system";
import type { GrowthTask } from "@/lib/growth-audit/types";

export default async function BusinessOverviewPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const auth = await requireAuth();
  const business = await getBusiness(businessId, auth.organizationId);
  if (!business) notFound();

  const [latestScan, keywords, audit, momentumData, growthAudit] = await Promise.all([
    getLatestScan(businessId),
    getBusinessKeywords(businessId),
    getLatestAudit(businessId),
    loadLatestMomentumRun(businessId),
    loadLatestGrowthAudit(businessId),
  ]);

  const { items } = audit ? await getActionPlanForAudit(audit.id) : { items: [] };
  const metrics = (latestScan?.aggregate_metrics ?? {}) as Record<string, number | null>;
  const momentumTarget = momentumData?.entities.find((e) => e.entity_type === "target");
  const mapsScore = metrics.visibilityScore ?? audit?.overall_score ?? null;
  const growthScore = growthAudit?.growth_score ?? null;

  const coreScores = [
    {
      label: "Growth Score",
      value: growthScore != null ? Math.round(growthScore) : null,
      href: `/businesses/${businessId}/growth-audit`,
    },
    {
      label: "Maps Score",
      value: mapsScore != null ? Math.round(Number(mapsScore)) : null,
      href: latestScan ? `/businesses/${businessId}/grid/${latestScan.id}` : undefined,
    },
    {
      label: "Review Momentum™",
      value:
        momentumTarget?.momentum_score != null
          ? Math.round(Number(momentumTarget.momentum_score))
          : null,
      href: `/businesses/${businessId}/review-momentum`,
    },
    {
      label: "Grid Visibility",
      value:
        metrics.visibilityScore != null ? Math.round(Number(metrics.visibilityScore)) : null,
      href: latestScan ? `/businesses/${businessId}/grid/${latestScan.id}` : undefined,
    },
  ];

  const growthPlanTasks = (growthAudit?.growth_plan_json as GrowthTask[] | null) ?? [];
  const recommendedItems =
    items.length > 0
      ? items.slice(0, 3)
      : growthPlanTasks.slice(0, 3).map((task, index) => ({
          id: `growth-${index}`,
          title: task.title,
          description: task.description,
          impact: task.impact,
        }));

  const auditScores = audit
    ? [
        { label: "Overall", value: audit.overall_score },
        { label: "Relevance", value: audit.relevance_score },
        { label: "Distance", value: audit.distance_score },
        { label: "Prominence", value: audit.prominence_score },
        { label: "Trust", value: audit.trust_score },
      ]
    : [];

  return (
    <ModulePage wide>
      <OverviewPageHeader
          businessId={businessId}
          name={business.name}
          address={business.address_text}
          primaryCategory={business.primary_category}
        />

        <section className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <GrowthAuditOverviewCard businessId={businessId} />
            <CitationHealthOverviewCard businessId={businessId} />
            <ReputationHealthOverviewCard businessId={businessId} />
            <ReviewRequestsOverviewCard businessId={businessId} />
            <BacklinkGapOverviewCard businessId={businessId} />
            <KeywordVisibilityOverviewCard businessId={businessId} />
          </div>
        </section>

        <section className="mt-6">
          <OverviewCoreScores businessId={businessId} scores={coreScores} />
        </section>

        <section className="mt-6">
          <ReviewMomentumOverviewSection businessId={businessId} />
        </section>

        {auditScores.length > 0 && (
          <section className="mt-6">
            <OverviewAuditSnapshot scores={auditScores} />
          </section>
        )}

        {recommendedItems.length > 0 && (
          <section className="mt-6">
            <OverviewRecommendedActions businessId={businessId} items={recommendedItems} />
          </section>
        )}

        <section className="mt-6">
          <OverviewFooterCta businessId={businessId} />
        </section>
    </ModulePage>
  );
}
