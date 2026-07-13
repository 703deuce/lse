import { requireAuth } from "@/lib/auth/context";
import {
  getBusiness,
  getLatestScan,
  getLatestAudit,
  getActionPlanForAudit,
} from "@/lib/db/queries";
import { notFound } from "next/navigation";
import { loadLatestMomentumRun } from "@/lib/reviews/momentum-engine";
import { loadLatestGrowthAudit } from "@/lib/growth-audit/engine";
import { ReviewMomentumOverviewSection } from "@/components/reviews/review-momentum-overview-section";
import { DashboardHeader } from "@/components/overview/dashboard-header";
import { DashboardQuickActions } from "@/components/overview/dashboard-quick-actions";
import { DashboardRecentScans } from "@/components/overview/dashboard-recent-scans";
import {
  OverviewCoreScores,
  OverviewAuditSnapshot,
  OverviewRecommendedActions,
  OverviewFooterCta,
} from "@/components/overview/overview-sections";
import { loadDashboardRecentScans } from "@/lib/overview/load-dashboard-scans";
import { ModulePage } from "@/components/ui/design-system";
import type { GrowthTask } from "@/lib/growth-audit/types";

function displayNameFromEmail(email: string | null): string {
  if (!email) return "there";
  const local = email.split("@")[0] ?? "there";
  const token = local.split(/[._-]/)[0] ?? local;
  return token.charAt(0).toUpperCase() + token.slice(1);
}

export default async function BusinessOverviewPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const auth = await requireAuth();
  const business = await getBusiness(businessId, auth.organizationId);
  if (!business) notFound();

  const [latestScan, audit, momentumData, growthAudit, recentScans] = await Promise.all([
    getLatestScan(businessId),
    getLatestAudit(businessId),
    loadLatestMomentumRun(businessId),
    loadLatestGrowthAudit(businessId),
    loadDashboardRecentScans(businessId, { preview: 3 }),
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
    <ModulePage wide className="!space-y-4">
      <DashboardHeader
        userName={displayNameFromEmail(auth.email)}
        businessName={business.name}
        businessId={businessId}
      />

      <DashboardQuickActions businessId={businessId} />

      <DashboardRecentScans
        businessId={businessId}
        rows={recentScans.rows}
        total={recentScans.total}
      />

      <section>
        <OverviewCoreScores businessId={businessId} scores={coreScores} />
      </section>

      <section>
        <ReviewMomentumOverviewSection businessId={businessId} />
      </section>

      {auditScores.length > 0 && (
        <section>
          <OverviewAuditSnapshot scores={auditScores} />
        </section>
      )}

      {recommendedItems.length > 0 && (
        <section>
          <OverviewRecommendedActions businessId={businessId} items={recommendedItems} />
        </section>
      )}

      <section>
        <OverviewFooterCta businessId={businessId} />
      </section>
    </ModulePage>
  );
}
