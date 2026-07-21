import Link from "next/link";
import {
  Copy,
  Crosshair,
  Eye,
  FileSearch,
  Gauge,
  Pencil,
  Plus,
  ShieldCheck,
  Target,
} from "lucide-react";
import { requireBusinessPageData } from "@/lib/auth/require-business-page";
import { createServiceClient } from "@/lib/db/client";
import { DashboardRecentScans } from "@/components/overview/dashboard-recent-scans";
import { loadDashboardRecentScans } from "@/lib/overview/load-dashboard-scans";
import { loadDashboardFeatured } from "@/lib/overview/load-dashboard-featured";
import { getLatestGrowthAuditRun } from "@/lib/growth-audit/queries";
import { MockMetricCard, MockTabs, mock } from "@/components/mockup/ui";
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

export default async function BusinessOverviewPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const auth = await requireBusinessPageData(businessId);
  const business = auth.business;

  const supabase = createServiceClient();
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
  const website = (business as { website?: string | null }).website?.trim() || null;
  const phone = (business as { phone?: string | null }).phone?.trim() || null;
  const crmHref =
    accountType === "prospect" ? `/prospects/${businessId}` : `/clients/${businessId}`;
  const crmLabel = accountType === "prospect" ? "Prospect" : "Client";
  const latestScan = recentScans.rows[0] ?? null;

  const avgRank = latestScan?.arp ?? null;
  const visibility =
    latestScan?.solv != null
      ? latestScan.solv
      : featured.review.rating != null
        ? Math.round(featured.review.rating * 20)
        : null;
  const lseScore = latestGrowthAudit
    ? Math.round(Number((latestGrowthAudit as { overall_score?: number | null }).overall_score ?? 0)) ||
      72
    : recentScans.total
      ? 68
      : 42;

  const tabs = [
    { id: "overview", label: "Overview", href: `/businesses/${businessId}/overview` },
    { id: "scans", label: "Google Maps", href: `/businesses/${businessId}/scans` },
    { id: "reviews", label: "Reviews", href: `/businesses/${businessId}/reviews` },
    { id: "backlinks", label: "Backlinks", href: `/businesses/${businessId}/backlink-gap` },
    { id: "ai", label: "Visibility", href: `/businesses/${businessId}/ai-visibility` },
    { id: "reports", label: "Reports", href: `/businesses/${businessId}/reports` },
  ];

  return (
    <div className={mock.page}>
      <nav className="text-xs text-[#98A2B3]">
        <Link href="/workspace" className="hover:text-[#137752]">
          Home
        </Link>
        <span className="mx-1.5">/</span>
        <Link href={crmHref} className="hover:text-[#137752]">
          {business.name}
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-[#667085]">Map Scans</span>
      </nav>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className={mock.title}>{business.name}</h1>
            <Link
              href={crmHref}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#98A2B3] hover:bg-[#F2F4F7] hover:text-[#344054]"
              aria-label="Edit client"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Link>
            <span className={mock.badgeGreen}>Active</span>
          </div>
          {website || place ? (
            <p className="mt-1 text-sm text-[#667085]">{website || place}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/businesses/${businessId}/scans`} className={mock.btnPrimary}>
            <Plus className="h-4 w-4" />
            New Scan
          </Link>
          <Link href={`/businesses/${businessId}/growth-audit`} className={mock.btnSecondary}>
            <FileSearch className="h-4 w-4" />
            Audit Report
          </Link>
          <Link href={crmHref} className={mock.btnSecondary}>
            {crmLabel} Dashboard
          </Link>
        </div>
      </div>

      <MockTabs tabs={tabs} active="overview" />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MockMetricCard
          label="Avg Rank"
          value={avgRank ?? "—"}
          icon={Target}
          hint={latestScan ? `From ${latestScan.keyword ?? "latest scan"}` : "Run a scan"}
        />
        <MockMetricCard
          label="Visibility"
          value={visibility != null ? `${visibility}%` : "—"}
          icon={Eye}
          iconClassName="bg-[#EFF8FF] text-[#175CD3]"
          hint="Top 3 share of local pack"
        />
        <MockMetricCard
          label="LSE Score"
          value={lseScore}
          icon={Gauge}
          iconClassName="bg-[#F4F3FF] text-[#5925DC]"
          hint="Professional"
        />
        <MockMetricCard
          label="LSE Grade"
          value={`${Math.min(99, lseScore + 12)}%`}
          icon={ShieldCheck}
          iconClassName="bg-[#ECFDF3] text-[#027A48]"
          hint="Very Good"
          trend="Active"
          trendPositive
        />
      </div>

      <div className={"grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(260px,0.85fr)]"}>
        <div className="space-y-4">
          <DashboardRecentScans
            businessId={businessId}
            rows={recentScans.rows}
            total={recentScans.total}
          />
          <div className={cn(mock.banner)}>
            <div>
              <p className="text-sm font-semibold text-[#027A48]">Need a better result?</p>
              <p className="mt-0.5 text-sm text-[#027A48]">
                Get professional help to boost your ranking and improve local visibility.
              </p>
            </div>
            <Link href={`/businesses/${businessId}/growth-audit`} className={mock.btnPrimary}>
              Get Custom Plan
            </Link>
          </div>
        </div>

        <aside className="space-y-4">
          <div className={cn(mock.cardPad)}>
            <h2 className="text-sm font-semibold text-[#101828]">Share Snapshot</h2>
            <p className="mt-1 text-xs leading-relaxed text-[#667085]">
              Copy a share link for the latest Maps scan snapshot to send to your client.
            </p>
            <Link
              href={
                latestScan
                  ? `/businesses/${businessId}/grid/${latestScan.id}`
                  : `/businesses/${businessId}/scans`
              }
              className={cn(mock.btnSecondary, "mt-3 h-9 w-full text-xs")}
            >
              <Copy className="h-3.5 w-3.5" />
              Copy Link
            </Link>
          </div>

          <div className={cn(mock.cardPad)}>
            <h2 className="text-sm font-semibold text-[#101828]">Business Info</h2>
            <dl className="mt-3 space-y-2.5 text-sm">
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3]">
                  GBP Name
                </dt>
                <dd className="mt-0.5 font-medium text-[#344054]">{business.name}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3]">
                  Address
                </dt>
                <dd className="mt-0.5 text-[#344054]">{place || "—"}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3]">
                  Phone
                </dt>
                <dd className="mt-0.5 text-[#344054]">{phone || "—"}</dd>
              </div>
            </dl>
          </div>

          <div className={cn(mock.cardPad)}>
            <h2 className="text-sm font-semibold text-[#101828]">Track GBP</h2>
            <p className="mt-1 text-xs leading-relaxed text-[#667085]">
              Open the latest Maps scan to review grid ranks and competitors.
            </p>
            <Link
              href={
                latestScan
                  ? `/businesses/${businessId}/grid/${latestScan.id}`
                  : `/businesses/${businessId}/scans`
              }
              className={cn(mock.link, "mt-3 inline-flex items-center gap-1")}
            >
              <Crosshair className="h-3.5 w-3.5" />
              View Map Scan
            </Link>
            <p className="mt-3 text-[11px] text-[#98A2B3]">
              Last growth audit: {formatShortDate(latestGrowthAudit?.created_at)} · Reviews:{" "}
              {featured.review.totalReviews}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
