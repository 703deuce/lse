"use client";

import { DashboardHeader } from "@/components/overview/dashboard-header";
import { DashboardRecentScans } from "@/components/overview/dashboard-recent-scans";
import { DashboardFeaturedReports } from "@/components/overview/dashboard-featured-reports";
import {
  HeroPanel,
  MetricStrip,
  ModulePage,
  btnPrimaryLg,
  heroMetricClass,
} from "@/components/ui/design-system";
import {
  SCREENSHOT_BUSINESS_ID,
  screenshotFeatured,
  screenshotScans,
} from "@/app/dev/dashboard-screenshot/mock-data";
import Link from "next/link";
import { Play } from "lucide-react";

/** Production-shaped dashboard for visual QA — hero + table hierarchy. */
export default function DashboardScreenshotPage() {
  const latest = screenshotScans[0];
  return (
    <ModulePage wide className="!space-y-5 px-4 py-4 lg:px-5">
      <DashboardHeader
        userName="Anthony"
        businessId={SCREENSHOT_BUSINESS_ID}
        businessName="Junk Removal Woodbridge"
        businesses={[
          { id: SCREENSHOT_BUSINESS_ID, name: "Junk Removal Woodbridge" },
          { id: "b2", name: "Bright Smile Dental" },
        ]}
      />

      <HeroPanel
        eyebrow="Maps visibility"
        title={latest?.keyword ?? "Latest Maps scan"}
        description="Jul 20, 2026 · 39% Top 3 · 7×7"
        metric={<span className={heroMetricClass}>{latest?.arp ?? 3.8}</span>}
        metricLabel="Avg rank"
        actions={
          <Link
            href={`/businesses/${SCREENSHOT_BUSINESS_ID}/grid/${latest?.id ?? "scan"}`}
            className={btnPrimaryLg}
          >
            <Play className="h-4 w-4 fill-current" />
            Open scan
          </Link>
        }
      />

      <MetricStrip
        items={[
          { label: "Reviews", value: "5.0★", href: `/businesses/${SCREENSHOT_BUSINESS_ID}/reviews` },
          {
            label: "Opportunities",
            value: String(screenshotFeatured.local.total),
            href: `/businesses/${SCREENSHOT_BUSINESS_ID}/trust`,
          },
          {
            label: "AI score",
            value: String(screenshotFeatured.ai.visibilityScore ?? 42),
            href: `/businesses/${SCREENSHOT_BUSINESS_ID}/ai-visibility`,
          },
          {
            label: "Growth audit",
            value: "Jul 19, 2026",
            href: `/businesses/${SCREENSHOT_BUSINESS_ID}/growth-audit`,
          },
        ]}
      />

      <DashboardRecentScans
        businessId={SCREENSHOT_BUSINESS_ID}
        rows={screenshotScans}
        total={38}
      />

      <DashboardFeaturedReports businessId={SCREENSHOT_BUSINESS_ID} data={screenshotFeatured} />
    </ModulePage>
  );
}
