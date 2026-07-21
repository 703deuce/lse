import Link from "next/link";
import { Grid3X3, Star, Lightbulb, FileSearch } from "lucide-react";
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
  dashboardCard,
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

/** Compact KPI chip — one row, no tall marketing cards. */
function KpiChip({
  label,
  value,
  href,
  icon: Icon,
}: {
  label: string;
  value: string;
  href: string;
  icon: typeof Grid3X3;
}) {
  return (
    <Link
      href={href}
      className={cn(
        dashboardCard,
        "flex min-w-0 items-center gap-2.5 px-3 py-2.5 transition hover:border-zinc-300"
      )}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-[#137752]">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">
        <p className={dashboardSectionLabel}>{label}</p>
        <p className="truncate text-[13px] font-semibold tabular-nums text-zinc-900">{value}</p>
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
    loadDashboardRecentScans(businessId, { preview: 8 }),
    loadDashboardFeatured(businessId),
    getLatestGrowthAuditRun(businessId).catch(() => null),
  ]);

  const accountType = (business as { account_type?: string | null }).account_type;
  const crmHref =
    accountType === "prospect" ? `/prospects/${businessId}` : `/clients/${businessId}`;
  const crmLabel = accountType === "prospect" ? "Prospect" : "Client";
  const latestScan = recentScans.rows[0] ?? null;

  const scanValue = latestScan
    ? latestScan.arp != null
      ? `Avg ${latestScan.arp}${latestScan.solv != null ? ` · ${latestScan.solv}% Top 3` : ""}`
      : latestScan.status
    : "No scan";

  const reviewValue =
    featured.review.rating != null
      ? `${featured.review.rating.toFixed(1)}★ · ${featured.review.newReviews90d} new/90d`
      : `${featured.review.totalReviews} reviews`;

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

      <div className="mt-3 space-y-3">
        <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <KpiChip
            label="Latest scan"
            value={scanValue}
            href={
              latestScan
                ? `/businesses/${businessId}/grid/${latestScan.id}`
                : `/businesses/${businessId}/scans`
            }
            icon={Grid3X3}
          />
          <KpiChip
            label="Reviews"
            value={reviewValue}
            href={`/businesses/${businessId}/reviews`}
            icon={Star}
          />
          <KpiChip
            label="Opportunities"
            value={`${featured.local.total} open`}
            href={`/businesses/${businessId}/trust`}
            icon={Lightbulb}
          />
          <KpiChip
            label="Growth audit"
            value={
              latestGrowthAudit
                ? formatShortDate(latestGrowthAudit.created_at)
                : "Not run"
            }
            href={`/businesses/${businessId}/growth-audit`}
            icon={FileSearch}
          />
        </section>

        <DashboardRecentScans
          businessId={businessId}
          rows={recentScans.rows}
          total={recentScans.total}
        />

        <DashboardFeaturedReports businessId={businessId} data={featured} />

        {!latestScan ? (
          <p className={cn(dashboardMicro, "px-0.5")}>
            No Maps baseline yet.{" "}
            <Link href={`/businesses/${businessId}/scans`} className={dashboardAccentLink}>
              Run a scan
            </Link>
          </p>
        ) : null}
      </div>
    </ModulePage>
  );
}
