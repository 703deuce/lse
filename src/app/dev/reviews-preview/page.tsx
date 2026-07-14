"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { DashboardSidebarPanel } from "@/components/dashboard/sidebar";
import { ReviewsDashboard } from "@/components/reviews/reviews-dashboard";
import { REVIEWS_PREVIEW_DATA } from "@/lib/reviews/reviews-preview-data";

export default function ReviewsPreviewPage() {
  const { businessId, businessName } = REVIEWS_PREVIEW_DATA;
  const reviewsPath = `/businesses/${businessId}/reviews`;

  return (
    <div className="flex min-h-screen bg-surface-muted">
      <DashboardSidebarPanel
        businessId={businessId}
        pathname={reviewsPath}
        businessName={businessName}
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
          <ReviewsDashboard businessId={businessId} />
        </Suspense>
      </main>
    </div>
  );
}
