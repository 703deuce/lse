"use client";

import { DashboardSidebarPanel } from "@/components/dashboard/sidebar";
import { MapsOverviewDashboard } from "@/components/maps/maps-overview-dashboard";
import { REVIEW_OVERVIEW_PREVIEW_BUSINESS_ID } from "@/lib/reviews/review-overview-preview-data";

export default function WorkflowMapsOverviewPreview() {
  const biz = REVIEW_OVERVIEW_PREVIEW_BUSINESS_ID;
  const path = `/businesses/${biz}/maps`;

  return (
    <div className="flex min-h-screen bg-[#F9FAFB]">
      <DashboardSidebarPanel
        businessId={biz}
        pathname={path}
        businessName="Junk Removal Woodbridge"
        staticLinks
        showFooter={false}
        mapsActivated
        phase="maps_activated"
      />
      <main className="min-w-0 flex-1 overflow-y-auto px-5 py-6 lg:px-8">
        <MapsOverviewDashboard
          businessId={biz}
          businessName="Junk Removal Woodbridge"
          latestScan={{
            id: "preview-scan",
            status: "ready",
            createdAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
            keyword: "Junk removal Woodbridge",
            keywordId: "kw1",
            averageRank: 4.2,
            top3Pct: 28,
            top10Pct: 62,
            visibilityScore: 62,
            centerLabel: "Woodbridge, VA",
            gridSize: 7,
            radiusMeters: 8047,
          }}
          previousScan={{
            id: "preview-scan-prev",
            status: "ready",
            createdAt: new Date(Date.now() - 86400000 * 14).toISOString(),
            finishedAt: new Date(Date.now() - 86400000 * 14).toISOString(),
            keyword: "Junk removal Woodbridge",
            keywordId: "kw1",
            averageRank: 5.1,
            top3Pct: 18,
            top10Pct: 50,
            visibilityScore: 50,
            centerLabel: "Woodbridge, VA",
            gridSize: 7,
            radiusMeters: 8047,
          }}
          keywordMovement={[
            {
              keyword: "Junk removal Woodbridge",
              keywordId: "kw1",
              latestAvgRank: 4.2,
              previousAvgRank: 5.1,
              change: 0.9,
              latestTop3Pct: 28,
              latestScanId: "preview-scan",
            },
            {
              keyword: "Furniture removal Woodbridge",
              keywordId: "kw2",
              latestAvgRank: 6.0,
              previousAvgRank: 6.0,
              change: 0,
              latestTop3Pct: 16,
              latestScanId: "preview-scan-2",
            },
            {
              keyword: "Appliance removal near me",
              keywordId: "kw3",
              latestAvgRank: 8.4,
              previousAvgRank: 7.1,
              change: -1.3,
              latestTop3Pct: 8,
              latestScanId: "preview-scan-3",
            },
          ]}
          nextScheduledAt={null}
          topCompetitorLabels={["Standout Trash", "All Star Junk", "Haul Away Pros"]}
        />
      </main>
    </div>
  );
}
