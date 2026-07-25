"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { DashboardSidebarPanel } from "@/components/dashboard/sidebar";
import { ReviewsDashboard } from "@/components/reviews/reviews-dashboard";
import {
  REVIEW_FEED_PREVIEW_BUSINESS_ID,
  reviewFeedPreviewData,
} from "@/lib/reviews/review-feed-preview-data";

export default function ReviewFeedPreviewPage() {
  const path = `/businesses/${REVIEW_FEED_PREVIEW_BUSINESS_ID}/reputation/reviews`;

  return (
    <div className="flex min-h-screen bg-[#F9FAFB]">
      <DashboardSidebarPanel
        businessId={REVIEW_FEED_PREVIEW_BUSINESS_ID}
        pathname={path}
        businessName="A-Team Junk Removal"
        staticLinks
        showFooter={false}
      />
      <main className="min-w-0 flex-1 overflow-y-auto px-5 py-6 lg:px-8">
        <Suspense
          fallback={
            <div className="flex min-h-[400px] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
          }
        >
          <ReviewsDashboard
            businessId={REVIEW_FEED_PREVIEW_BUSINESS_ID}
            initialData={reviewFeedPreviewData}
            forcePreview
          />
        </Suspense>
      </main>
    </div>
  );
}
