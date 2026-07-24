"use client";

import { DashboardSidebarPanel } from "@/components/dashboard/sidebar";
import { ReviewOverviewDashboard } from "@/components/reviews/review-overview-dashboard";
import {
  REVIEW_OVERVIEW_PREVIEW_BUSINESS_ID,
  reviewOverviewPreviewData,
} from "@/lib/reviews/review-overview-preview-data";

export default function ReviewOverviewPreviewPage() {
  const path = `/businesses/${REVIEW_OVERVIEW_PREVIEW_BUSINESS_ID}/reputation/overview`;

  return (
    <div className="flex min-h-screen bg-[#F9FAFB]">
      <DashboardSidebarPanel
        businessId={REVIEW_OVERVIEW_PREVIEW_BUSINESS_ID}
        pathname={path}
        businessName="A-Team Junk Removal"
        staticLinks
        showFooter={false}
      />
      <main className="min-w-0 flex-1 overflow-y-auto px-5 py-6 lg:px-8">
        <ReviewOverviewDashboard
          businessId={REVIEW_OVERVIEW_PREVIEW_BUSINESS_ID}
          data={reviewOverviewPreviewData}
        />
      </main>
    </div>
  );
}
