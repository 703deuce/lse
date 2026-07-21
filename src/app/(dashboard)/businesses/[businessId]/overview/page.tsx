import Link from "next/link";
import { ArrowRight, ClipboardList, FileSearch, Grid3X3, Lightbulb, Star } from "lucide-react";
import { requireBusinessPageData } from "@/lib/auth/require-business-page";
import { createServiceClient } from "@/lib/db/client";
import { DashboardHeader } from "@/components/overview/dashboard-header";
import { DashboardRecentScans } from "@/components/overview/dashboard-recent-scans";
import { DashboardFeaturedReports } from "@/components/overview/dashboard-featured-reports";
import { loadDashboardRecentScans } from "@/lib/overview/load-dashboard-scans";
import { loadDashboardFeatured } from "@/lib/overview/load-dashboard-featured";
import { JourneyBreadcrumbs } from "@/components/journey/journey-breadcrumbs";
import { ModulePage } from "@/components/ui/design-system";
import {
  dashboardAccentLink,
  dashboardBadge,
  dashboardBody,
  dashboardCard,
  dashboardCardTitle,
  dashboardMicro,
  dashboardSectionLabel,
} from "@/components/overview/dashboard-ui";
import { getLatestGrowthAuditRun } from "@/lib/growth-audit/queries";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function displayNameFromEmail(email: string | null): string {
  if (!email) return "there";
  const local = email.split("@")[0] ?? "there";
  const token = local.split(/[._-]/)[0] ?? local;
  return token.charAt(0).toUpperCase() + token.slice(1);
}

/** Prefer first name → full name → email local-part (never org slug-looking tokens). */
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

function OverviewSignalCard({
  title,
  value,
  meta,
  href,
  icon: Icon,
  badge,
}: {
  title: string;
  value: string;
  meta: string;
  href: string;
  icon: typeof Grid3X3;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        dashboardCard,
        "group flex min-h-[108px] flex-col justify-between p-3.5 transition hover:border-zinc-300"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 bg-white text-[#137752]">
          <Icon className="h-4 w-4" />
        </span>
        {badge ? (
          <span className={cn(dashboardBadge, "bg-zinc-100 text-zinc-600")}>{badge}</span>
        ) : null}
      </div>
      <div>
        <p className={dashboardSectionLabel}>{title}</p>
        <p className="mt-1 text-[17px] font-semibold leading-tight text-zinc-900">{value}</p>
        <p className={cn(dashboardMicro, "mt-1 line-clamp-2")}>{meta}</p>
      </div>
    </Link>
  );
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
    loadDashboardRecentScans(businessId, { preview: 3 }),
    loadDashboardFeatured(businessId),
    getLatestGrowthAuditRun(businessId).catch(() => null),
  ]);

  const accountType = (business as { account_type?: string | null }).account_type;
  const crmHref =
    accountType === "prospect" ? `/prospects/${businessId}` : `/clients/${businessId}`;
  const crmLabel = accountType === "prospect" ? "Prospect" : "Client";
  const latestScan = recentScans.rows[0] ?? null;
  const nextOpportunity = featured.local.items[0] ?? null;
  const nextAction =
    nextOpportunity?.suggestedAction ??
    nextOpportunity?.title ??
    (!latestScan ? "Run a Maps scan to establish the first rank baseline." : "Review latest scan movement and update the growth plan.");
  const nextActionHref = nextOpportunity
    ? `/businesses/${businessId}/trust`
    : latestScan
      ? `/businesses/${businessId}/grid/${latestScan.id}`
      : `/businesses/${businessId}/scans`;

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

      <div className="mt-4 space-y-4">
        <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <OverviewSignalCard
            title="Latest scan"
            value={
              latestScan
                ? latestScan.arp != null
                  ? `Avg rank ${latestScan.arp}`
                  : latestScan.status
                : "No scan yet"
            }
            meta={
              latestScan
                ? `${latestScan.keyword ?? "Maps keyword"} · ${formatShortDate(latestScan.createdAt)}`
                : "Start with a quick grid scan for this location."
            }
            href={latestScan ? `/businesses/${businessId}/grid/${latestScan.id}` : `/businesses/${businessId}/scans`}
            icon={Grid3X3}
            badge={latestScan?.solv != null ? `${latestScan.solv}% Top 3` : undefined}
          />
          <OverviewSignalCard
            title="Review pulse"
            value={
              featured.review.rating != null
                ? `${featured.review.rating.toFixed(1)} stars`
                : "No review data"
            }
            meta={`${featured.review.newReviews90d} new in 90d · ${
              featured.review.responseRate != null
                ? `${featured.review.responseRate}% response rate`
                : `${featured.review.totalReviews} total reviews`
            }`}
            href={`/businesses/${businessId}/reviews`}
            icon={Star}
          />
          <OverviewSignalCard
            title="Open opportunities"
            value={`${featured.local.total}`}
            meta={
              nextOpportunity
                ? nextOpportunity.title
                : "Run Local Trust to find sponsorships, citations, and community links."
            }
            href={`/businesses/${businessId}/trust`}
            icon={Lightbulb}
          />
          <OverviewSignalCard
            title="Next action"
            value={nextOpportunity?.priority ? `${nextOpportunity.priority} priority` : "Recommended"}
            meta={nextAction}
            href={nextActionHref}
            icon={ClipboardList}
          />
          <OverviewSignalCard
            title="Last growth audit"
            value={latestGrowthAudit ? formatShortDate(latestGrowthAudit.created_at) : "Not run"}
            meta={
              latestGrowthAudit
                ? `Status: ${String(latestGrowthAudit.status ?? "complete")}`
                : "Run an audit to create a focused local SEO action plan."
            }
            href={`/businesses/${businessId}/growth-audit`}
            icon={FileSearch}
          />
        </section>

        <section className={cn(dashboardCard, "p-3.5")}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className={dashboardCardTitle}>Recommended next step</h2>
              <p className={cn(dashboardBody, "mt-1 max-w-3xl")}>{nextAction}</p>
            </div>
            <Link href={nextActionHref} className={cn(dashboardAccentLink, "inline-flex items-center gap-1")}>
              Open
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </section>

        <DashboardRecentScans
          businessId={businessId}
          rows={recentScans.rows}
          total={recentScans.total}
        />
        <DashboardFeaturedReports businessId={businessId} data={featured} />
      </div>
    </ModulePage>
  );
}
