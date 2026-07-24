"use client";

import { DashboardSidebarPanel } from "@/components/dashboard/sidebar";
import { ReviewInsightsDashboard } from "@/components/reviews/review-insights-dashboard";
import {
  REVIEW_INSIGHTS_PREVIEW_BUSINESS_ID,
  reviewInsightsPreviewData,
} from "@/lib/reviews/review-insights-preview-data";

export default function ReviewInsightsPreviewPage() {
  const path = `/businesses/${REVIEW_INSIGHTS_PREVIEW_BUSINESS_ID}/reputation/insights`;

  return (
    <div className="flex min-h-screen bg-[#F9FAFB]">
      <DashboardSidebarPanel
        businessId={REVIEW_INSIGHTS_PREVIEW_BUSINESS_ID}
        pathname={path}
        businessName="A-Team Junk Removal"
        staticLinks
        showFooter={false}
      />
      <main className="min-w-0 flex-1 overflow-y-auto px-5 py-6 lg:px-8">
        <ReviewInsightsDashboard
          businessId={REVIEW_INSIGHTS_PREVIEW_BUSINESS_ID}
          data={reviewInsightsPreviewData}
        />
      </main>
    </div>
  );
}
