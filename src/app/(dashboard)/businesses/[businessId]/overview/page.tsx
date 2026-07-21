import Link from "next/link";
import { Play } from "lucide-react";
import { requireBusinessPageData } from "@/lib/auth/require-business-page";
import { createServiceClient } from "@/lib/db/client";
import { DashboardHeader } from "@/components/overview/dashboard-header";
import { DashboardRecentScans } from "@/components/overview/dashboard-recent-scans";
import { DashboardFeaturedReports } from "@/components/overview/dashboard-featured-reports";
import { loadDashboardRecentScans } from "@/lib/overview/load-dashboard-scans";
import { loadDashboardFeatured } from "@/lib/overview/load-dashboard-featured";
import { JourneyBreadcrumbs } from "@/components/journey/journey-breadcrumbs";
import {
  HeroPanel,
  MetricStrip,
  ModulePage,
  btnPrimaryLg,
  heroMetricClass,
  microClass,
} from "@/components/ui/design-system";
import { getLatestGrowthAuditRun } from "@/lib/growth-audit/queries";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function displayNameFromEmail(email: string | null): string {
  if (!email) return "there";
  const local = email.split("@")[0] ?? "there";
  const token = local.split(/[._-]/)[0] ?? local;
  return token.charAt(0).toUpperCase() + token.slice(1);
}

function greetingNameFromProfile(fullName: string | null | undefined, email: string | null): string {
  const full = String(fullName ?? "").trim();
  if (full) {
    const first = full.split(/\s+/).find(Boolean);
    if (first) return first;
    return full;
  }
  return displayNameFromEmail(email);
}

async function resolveDisplayName(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  email: string | null
): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", userId)
    .maybeSingle();
  return greetingNameFromProfile(
    profile?.full_name as string | null | undefined,
    email ?? (profile?.email as string | null) ?? null
  );
}

function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function BusinessOverviewPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const auth = await requireBusinessPageData(businessId);
  const business = auth.business;

  const supabase = createServiceClient();
  const [{ data: businesses }, displayName] = await Promise.all([
    supabase
      .from("businesses")
      .select("id, name")
      .eq("organization_id", auth.organizationId)
      .order("name"),
    resolveDisplayName(supabase, auth.userId, auth.email),
  ]);

  const [recentScans, featured, latestGrowthAudit] = await Promise.all([
    loadDashboardRecentScans(businessId, { preview: 8 }),
    loadDashboardFeatured(businessId),
    getLatestGrowthAuditRun(businessId).catch(() => null),
  ]);

  const accountType = (business as { account_type?: string | null }).account_type;
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

  return (
    <ModulePage wide>
      <JourneyBreadcrumbs
        items={[
          { label: crmLabel + "s", href: accountType === "prospect" ? "/prospects" : "/clients" },
          { label: business.name, href: crmHref },
          { label: "Dashboard" },
        ]}
      />
      <DashboardHeader
        userName={displayName}
        businessId={businessId}
        businessName={business.name}
        businesses={(businesses ?? []).map((b) => ({
          id: b.id as string,
          name: b.name as string,
        }))}
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

      <DashboardRecentScans
        businessId={businessId}
        rows={recentScans.rows}
        total={recentScans.total}
      />

      <DashboardFeaturedReports businessId={businessId} data={featured} />

      {!latestScan ? (
        <p className={microClass}>
          No Maps baseline yet.{" "}
          <Link href={`/businesses/${businessId}/scans`} className="font-semibold text-[#137752]">
            Run a scan
          </Link>
        </p>
      ) : null}
    </ModulePage>
  );
}
