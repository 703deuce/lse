import Link from "next/link";
import { Play } from "lucide-react";
import { requireBusinessPageData } from "@/lib/auth/require-business-page";
import { DashboardRecentScans } from "@/components/overview/dashboard-recent-scans";
import { DashboardFeaturedReports } from "@/components/overview/dashboard-featured-reports";
import { loadDashboardRecentScans } from "@/lib/overview/load-dashboard-scans";
import { loadDashboardFeatured } from "@/lib/overview/load-dashboard-featured";
import { JourneyBreadcrumbs } from "@/components/journey/journey-breadcrumbs";
import {
  ContentCard,
  HeroPanel,
  InsightPanel,
  MetricStrip,
  ModulePage,
  PageHeader,
  PageSection,
  btnGhost,
  btnPrimary,
  btnPrimaryLg,
  heroMetricClass,
  sectionTitleClass,
} from "@/components/ui/design-system";
import { getLatestGrowthAuditRun } from "@/lib/growth-audit/queries";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function healthLabel(args: {
  hasScan: boolean;
  reviewNeedsReply: boolean;
  aiLow: boolean;
  opportunities: number;
}): { visibility: string; reviews: string; ai: string; backlinks: string } {
  return {
    visibility: args.hasScan ? "Improving" : "Needs baseline",
    reviews: args.reviewNeedsReply ? "Needs attention" : "Stable",
    ai: args.aiLow ? "Low" : "Tracked",
    backlinks: args.opportunities > 0 ? "Opportunities open" : "Stable",
  };
}

/**
 * Client Overview — unified health of this location:
 * what changed, what needs attention, what to do next.
 */
export default async function BusinessOverviewPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const auth = await requireBusinessPageData(businessId);
  const business = auth.business;

  const [recentScans, featured, latestGrowthAudit] = await Promise.all([
    loadDashboardRecentScans(businessId, { preview: 8 }),
    loadDashboardFeatured(businessId),
    getLatestGrowthAuditRun(businessId).catch(() => null),
  ]);

  const accountType = (business as { account_type?: string | null }).account_type;
  const place =
    (business as { scan_center_label?: string | null }).scan_center_label?.trim() ||
    (business as { address_text?: string | null }).address_text?.trim() ||
    null;
  const crmHref =
    accountType === "prospect" ? `/prospects/${businessId}` : `/clients/${businessId}`;
  const crmLabel = accountType === "prospect" ? "Prospect" : "Client";
  const latestScan = recentScans.rows[0] ?? null;

  const heroHref = latestScan
    ? `/businesses/${businessId}/grid/${latestScan.id}`
    : `/businesses/${businessId}/scans`;

  const heroMetric =
    latestScan?.arp != null ? (
      <span className={heroMetricClass}>{latestScan.arp}</span>
    ) : (
      <span className={cn(heroMetricClass, "text-zinc-300")}>—</span>
    );

  const reviewValue =
    featured.review.rating != null
      ? `${featured.review.rating.toFixed(1)}★`
      : `${featured.review.totalReviews}`;

  const unanswered = featured.review.latestReviews.filter((r) => !r.replied).length;
  const aiScore = featured.ai.visibilityScore;
  const health = healthLabel({
    hasScan: Boolean(latestScan),
    reviewNeedsReply: unanswered > 0 || (featured.review.responseRate != null && featured.review.responseRate < 50),
    aiLow: aiScore == null || aiScore < 40,
    opportunities: featured.local.total,
  });

  const actions: Array<{ title: string; href: string; why: string }> = [];
  if (unanswered > 0 || (featured.review.responseRate != null && featured.review.responseRate === 0)) {
    const count = unanswered || featured.review.latestReviews.length || 1;
    actions.push({
      title: `Reply to ${count} review${count === 1 ? "" : "s"}`,
      href: `/businesses/${businessId}/reviews?tab=unanswered`,
      why: "Open reviews hurt conversion and AI/local trust signals.",
    });
  }
  if (featured.local.total > 0) {
    actions.push({
      title: `Pursue ${Math.min(featured.local.total, 3)} local trust opportunities`,
      href: `/businesses/${businessId}/trust`,
      why: "High-signal directories and citations still open in this market.",
    });
  }
  if (aiScore == null || aiScore < 40) {
    actions.push({
      title: "Improve AI mention coverage",
      href: `/businesses/${businessId}/ai-visibility`,
      why: "AI platforms rarely recommend this business today.",
    });
  }
  if (!latestScan) {
    actions.unshift({
      title: "Run a Maps baseline scan",
      href: `/businesses/${businessId}/scans`,
      why: "Everything else is easier to prioritize with a ranking baseline.",
    });
  }

  return (
    <ModulePage wide>
      <JourneyBreadcrumbs
        items={[
          { label: crmLabel + "s", href: accountType === "prospect" ? "/prospects" : "/clients" },
          { label: business.name, href: crmHref },
          { label: "Overview" },
        ]}
      />

      <PageHeader
        title={business.name}
        description={[place, crmLabel].filter(Boolean).join(" · ")}
        secondaryActions={
          <Link href={crmHref} className={btnGhost}>
            Open {crmLabel.toLowerCase()} record
          </Link>
        }
        primaryAction={
          <Link href={`/businesses/${businessId}/scans`} className={btnPrimary}>
            <Play className="h-4 w-4 fill-current" />
            Run scan
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {(
          [
            ["Local visibility", health.visibility, `/businesses/${businessId}/scans`],
            ["Reviews", health.reviews, `/businesses/${businessId}/reviews`],
            ["AI visibility", health.ai, `/businesses/${businessId}/ai-visibility`],
            ["Backlinks / trust", health.backlinks, `/businesses/${businessId}/trust`],
          ] as const
        ).map(([label, value, href]) => (
          <Link key={label} href={href}>
            <ContentCard className="h-full transition hover:border-[var(--primary)]/30">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                {label}
              </p>
              <p className="mt-2 text-lg font-semibold text-[var(--text)]">{value}</p>
            </ContentCard>
          </Link>
        ))}
      </div>

      <HeroPanel
        eyebrow="Maps visibility"
        title={
          latestScan
            ? latestScan.keyword ?? "Latest Maps scan"
            : "Establish your Maps baseline"
        }
        description={
          latestScan
            ? `${formatShortDate(latestScan.createdAt)}${
                latestScan.solv != null ? ` · ${latestScan.solv}% Top 3` : ""
              }${latestScan.gridSize ? ` · ${latestScan.gridSize}×${latestScan.gridSize}` : ""}`
            : "Run a grid scan to measure average rank and share of local visibility."
        }
        metric={heroMetric}
        metricLabel="Avg rank"
        actions={
          <Link href={heroHref} className={btnPrimaryLg}>
            <Play className="h-4 w-4 fill-current" />
            {latestScan ? "Open scan" : "Run scan"}
          </Link>
        }
      />

      <MetricStrip
        items={[
          {
            label: "Reviews",
            value: reviewValue,
            href: `/businesses/${businessId}/reviews`,
          },
          {
            label: "Opportunities",
            value: String(featured.local.total),
            href: `/businesses/${businessId}/trust`,
          },
          {
            label: "AI score",
            value: featured.ai.hasData
              ? featured.ai.visibilityScore != null
                ? String(featured.ai.visibilityScore)
                : "—"
              : "—",
            href: `/businesses/${businessId}/ai-visibility`,
          },
          {
            label: "Growth audit",
            value: latestGrowthAudit
              ? formatShortDate(latestGrowthAudit.created_at)
              : "Not run",
            href: `/businesses/${businessId}/growth-audit`,
          },
        ]}
      />

      {actions.length > 0 ? (
        <PageSection title="Recommended actions" description="Highest-leverage next steps for this location.">
          <div className="grid gap-3 lg:grid-cols-3">
            {actions.slice(0, 3).map((a, i) => (
              <InsightPanel
                key={a.href}
                title={`${i + 1}. ${a.title}`}
                action={
                  <Link href={a.href} className={btnPrimary}>
                    Open
                  </Link>
                }
              >
                {a.why}
              </InsightPanel>
            ))}
          </div>
        </PageSection>
      ) : null}

      <PageSection title="Recent activity">
        <DashboardRecentScans
          businessId={businessId}
          rows={recentScans.rows}
          total={recentScans.total}
        />
      </PageSection>

      <div>
        <h2 className={cn(sectionTitleClass, "mb-3")}>Module snapshots</h2>
        <DashboardFeaturedReports businessId={businessId} data={featured} />
      </div>
    </ModulePage>
  );
}
