"use client";

import { useLayoutEffect, useState } from "react";
import { DashboardSidebarPanel } from "@/components/dashboard/sidebar";
import { ReviewRequestsDashboard } from "@/components/reputation/review-requests-dashboard";
import {
  REVIEW_REQUESTS_PREVIEW_BUSINESS_ID,
  reviewRequestsPreviewCampaigns,
  reviewRequestsPreviewKit,
  reviewRequestsPreviewStats,
} from "@/lib/reputation/review-requests-preview-data";

let fetchPatched = false;

function patchReviewRequestsPreviewFetch() {
  if (typeof window === "undefined" || fetchPatched) return;
  fetchPatched = true;
  const originalFetch = window.fetch.bind(window);
  const bid = REVIEW_REQUESTS_PREVIEW_BUSINESS_ID;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();

    if (url.includes(`/api/reputation/review-link/${bid}`)) {
      return new Response(JSON.stringify(reviewRequestsPreviewKit), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes(`/api/reputation/review-requests/stats/${bid}`)) {
      return new Response(JSON.stringify(reviewRequestsPreviewStats), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/api/reputation/review-requests/campaigns") && method === "GET") {
      return new Response(JSON.stringify(reviewRequestsPreviewCampaigns), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (
      url.includes("/api/reputation/review-link/") ||
      url.includes("/api/reputation/templates/generate") ||
      url.includes("/api/reputation/review-requests/")
    ) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    return originalFetch(input, init);
  };
}

export default function ReviewRequestsPreviewPage() {
  const [ready, setReady] = useState(false);
  const path = `/businesses/${REVIEW_REQUESTS_PREVIEW_BUSINESS_ID}/reputation/requests`;

  useLayoutEffect(() => {
    patchReviewRequestsPreviewFetch();
    setReady(true);
  }, []);

  if (!ready) return null;

  return (
    <div className="flex min-h-screen bg-[#F9FAFB]">
      <DashboardSidebarPanel
        businessId={REVIEW_REQUESTS_PREVIEW_BUSINESS_ID}
        pathname={path}
        businessName="Premier Junk Removal"
        staticLinks
        showFooter={false}
      />
      <main className="min-w-0 flex-1 overflow-y-auto px-5 py-6 lg:px-8">
        <ReviewRequestsDashboard
          businessId={REVIEW_REQUESTS_PREVIEW_BUSINESS_ID}
        />
      </main>
    </div>
  );
}
