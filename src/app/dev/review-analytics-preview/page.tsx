"use client";

import { DashboardSidebarPanel } from "@/components/dashboard/sidebar";
import { ReviewVelocityDashboard } from "@/components/reviews/review-velocity-dashboard";
import {
  REVIEW_ANALYTICS_PREVIEW_BUSINESS_ID,
  reviewAnalyticsPreviewData,
} from "@/lib/reviews/review-analytics-preview-data";

export default function ReviewAnalyticsPreviewPage() {
  const path = `/businesses/${REVIEW_ANALYTICS_PREVIEW_BUSINESS_ID}/reputation/analytics`;

  return (
    <div className="flex min-h-screen bg-[#F9FAFB]">
      <DashboardSidebarPanel
        businessId={REVIEW_ANALYTICS_PREVIEW_BUSINESS_ID}
        pathname={path}
        businessName="A-Team Junk Removal"
        staticLinks
        showFooter={false}
      />
      <main className="min-w-0 flex-1 overflow-y-auto px-5 py-6 lg:px-8">
        <ReviewVelocityDashboard
          businessId={REVIEW_ANALYTICS_PREVIEW_BUSINESS_ID}
          data={reviewAnalyticsPreviewData}
        />
      </main>
    </div>
  );
}
