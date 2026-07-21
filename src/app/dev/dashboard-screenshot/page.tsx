"use client";

import { DashboardHeader } from "@/components/overview/dashboard-header";
import { DashboardRecentScans } from "@/components/overview/dashboard-recent-scans";
import { DashboardFeaturedReports } from "@/components/overview/dashboard-featured-reports";
import { ModulePage } from "@/components/ui/design-system";
import {
  SCREENSHOT_BUSINESS_ID,
  screenshotFeatured,
  screenshotScans,
} from "@/app/dev/dashboard-screenshot/mock-data";
import Link from "next/link";
import { FileSearch, Grid3X3, Lightbulb, Star } from "lucide-react";
import {
  dashboardCard,
  dashboardSectionLabel,
} from "@/components/overview/dashboard-ui";
import { cn } from "@/lib/utils";

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

/** Production-shaped dashboard for visual QA — no quick-action tiles or tools strip. */
export default function DashboardScreenshotPage() {
  return (
    <ModulePage wide className="!space-y-3 px-4 py-4 lg:px-5">
      <DashboardHeader
        userName="Anthony"
        businessId={SCREENSHOT_BUSINESS_ID}
        businessName="Junk Removal Woodbridge"
        businesses={[
          { id: SCREENSHOT_BUSINESS_ID, name: "Junk Removal Woodbridge" },
          { id: "b2", name: "Bright Smile Dental" },
        ]}
      />

      <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <KpiChip
          label="Latest scan"
          value="Avg 3.8 · 39% Top 3"
          href={`/businesses/${SCREENSHOT_BUSINESS_ID}/scans`}
          icon={Grid3X3}
        />
        <KpiChip
          label="Reviews"
          value="5.0★ · 2 new/90d"
          href={`/businesses/${SCREENSHOT_BUSINESS_ID}/reviews`}
          icon={Star}
        />
        <KpiChip
          label="Opportunities"
          value={`${screenshotFeatured.local.total} open`}
          href={`/businesses/${SCREENSHOT_BUSINESS_ID}/trust`}
          icon={Lightbulb}
        />
        <KpiChip
          label="Growth audit"
          value="Jul 19, 2026"
          href={`/businesses/${SCREENSHOT_BUSINESS_ID}/growth-audit`}
          icon={FileSearch}
        />
      </section>

      <DashboardRecentScans
        businessId={SCREENSHOT_BUSINESS_ID}
        rows={screenshotScans}
        total={38}
      />

      <DashboardFeaturedReports businessId={SCREENSHOT_BUSINESS_ID} data={screenshotFeatured} />
    </ModulePage>
  );
}
