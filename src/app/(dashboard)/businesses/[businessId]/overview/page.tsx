import Link from "next/link";
import { Play } from "lucide-react";
import { requireBusinessPageData } from "@/lib/auth/require-business-page";
import { DashboardRecentScans } from "@/components/overview/dashboard-recent-scans";
import { DashboardFeaturedReports } from "@/components/overview/dashboard-featured-reports";
import { loadDashboardRecentScans } from "@/lib/overview/load-dashboard-scans";
import { loadDashboardFeatured } from "@/lib/overview/load-dashboard-featured";
import { JourneyBreadcrumbs } from "@/components/journey/journey-breadcrumbs";
import {
  HeroPanel,
  MetricStrip,
  ModulePage,
  PageHeader,
  PageSection,
  btnGhost,
  btnPrimary,
  btnPrimaryLg,
  heroMetricClass,
  listClass,
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
            label: "Local visibility",
            value: health.visibility,
            href: `/businesses/${businessId}/scans`,
          },
          {
            label: "Reviews",
            value: `${health.reviews} · ${reviewValue}`,
            href: `/businesses/${businessId}/reviews`,
          },
          {
            label: "AI visibility",
            value: featured.ai.hasData
              ? featured.ai.visibilityScore != null
                ? `${health.ai} · ${featured.ai.visibilityScore}`
                : health.ai
              : health.ai,
            href: `/businesses/${businessId}/ai-visibility`,
          },
          {
            label: "Backlinks / trust",
            value:
              featured.local.total > 0
                ? `${health.backlinks} · ${featured.local.total}`
                : health.backlinks,
            href: `/businesses/${businessId}/trust`,
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
        <PageSection
          title="Recommended next steps"
          description="Highest-leverage work for this location — ranked, not equal cards."
        >
          <ol className={listClass}>
            {actions.slice(0, 3).map((a, i) => (
              <li
                key={a.href}
                className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--primary-subtle)] text-[11px] font-bold text-[var(--primary)]">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--text)]">{a.title}</p>
                    <p className="mt-0.5 text-sm leading-snug text-[var(--text-secondary)]">{a.why}</p>
                  </div>
                </div>
                <Link
                  href={a.href}
                  className={cn(
                    i === 0 ? btnPrimary : btnGhost,
                    "h-8 shrink-0 px-3 text-xs"
                  )}
                >
                  {i === 0 ? "Start" : "Open"}
                </Link>
              </li>
            ))}
          </ol>
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
