"use client";

import { DashboardHeader } from "@/components/overview/dashboard-header";
import { DashboardQuickActions } from "@/components/overview/dashboard-quick-actions";
import { DashboardRecentScans } from "@/components/overview/dashboard-recent-scans";
import { DashboardFeaturedReports } from "@/components/overview/dashboard-featured-reports";
import { DashboardToolsRow } from "@/components/overview/dashboard-tools-row";
import { ModulePage } from "@/components/ui/design-system";
import {
  SCREENSHOT_BUSINESS_ID,
  screenshotFeatured,
  screenshotScans,
} from "@/app/dev/dashboard-screenshot/mock-data";

export default function DashboardScreenshotPage() {
  return (
    <ModulePage wide className="!space-y-5 px-5 py-6 lg:px-8">
      <DashboardHeader
        userName="Anthony"
        businessId={SCREENSHOT_BUSINESS_ID}
        businessName="Junk Removal Woodbridge"
        businesses={[
          { id: SCREENSHOT_BUSINESS_ID, name: "Junk Removal Woodbridge" },
          { id: "b2", name: "Bright Smile Dental" },
        ]}
      />

      <DashboardQuickActions businessId={SCREENSHOT_BUSINESS_ID} />

      <DashboardRecentScans
        businessId={SCREENSHOT_BUSINESS_ID}
        rows={screenshotScans}
        total={38}
      />

      <DashboardFeaturedReports businessId={SCREENSHOT_BUSINESS_ID} data={screenshotFeatured} />

      <DashboardToolsRow businessId={SCREENSHOT_BUSINESS_ID} />
    </ModulePage>
  );
}
