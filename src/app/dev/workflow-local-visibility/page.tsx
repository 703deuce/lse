"use client";

import { DashboardSidebarPanel } from "@/components/dashboard/sidebar";
import { MapsBridgeScreen } from "@/components/maps/maps-bridge-screen";
import {
  REVIEW_OVERVIEW_PREVIEW_BUSINESS_ID,
  reviewOverviewPreviewData,
} from "@/lib/reviews/review-overview-preview-data";

export default function WorkflowLocalVisibilityPreview() {
  const path = `/businesses/${REVIEW_OVERVIEW_PREVIEW_BUSINESS_ID}/local-visibility`;
  const data = { ...reviewOverviewPreviewData, hasMapsData: false };

  return (
    <div className="flex min-h-screen bg-[#F9FAFB]">
      <DashboardSidebarPanel
        businessId={REVIEW_OVERVIEW_PREVIEW_BUSINESS_ID}
        pathname={path}
        businessName="Junk Removal Woodbridge"
        staticLinks
        showFooter={false}
        mapsActivated={false}
        phase="reputation_ready"
      />
      <main className="min-w-0 flex-1 overflow-y-auto px-5 py-6 lg:px-8">
        <MapsBridgeScreen
          businessId={REVIEW_OVERVIEW_PREVIEW_BUSINESS_ID}
          businessName="Junk Removal Woodbridge"
          overview={data}
          hasMapsScan={false}
        />
      </main>
    </div>
  );
}
