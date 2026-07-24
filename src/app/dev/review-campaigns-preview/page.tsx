"use client";

import { useLayoutEffect, useState } from "react";
import { DashboardSidebarPanel } from "@/components/dashboard/sidebar";
import { ReviewCampaignsHub } from "@/components/reputation/review-campaigns-hub";
import {
  REVIEW_CAMPAIGNS_PREVIEW_BUSINESS_ID,
  reviewCampaignsPreviewResponse,
} from "@/lib/reputation/review-campaigns-preview-data";

let fetchPatched = false;

function patchCampaignsPreviewFetch() {
  if (typeof window === "undefined" || fetchPatched) return;
  fetchPatched = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();

    if (url.includes("/api/reputation/review-requests/campaigns") && method === "GET") {
      return new Response(JSON.stringify(reviewCampaignsPreviewResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/api/reputation/review-requests/campaigns")) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return originalFetch(input, init);
  };
}

export default function ReviewCampaignsPreviewPage() {
  const [ready, setReady] = useState(false);
  const path = `/businesses/${REVIEW_CAMPAIGNS_PREVIEW_BUSINESS_ID}/reputation/campaigns`;

  useLayoutEffect(() => {
    patchCampaignsPreviewFetch();
    setReady(true);
  }, []);

  if (!ready) return null;

  return (
    <div className="flex min-h-screen bg-[#F9FAFB]">
      <DashboardSidebarPanel
        businessId={REVIEW_CAMPAIGNS_PREVIEW_BUSINESS_ID}
        pathname={path}
        businessName="Premier Junk Removal"
        staticLinks
        showFooter={false}
      />
      <main className="min-w-0 flex-1 overflow-y-auto px-5 py-6 lg:px-8">
        <ReviewCampaignsHub businessId={REVIEW_CAMPAIGNS_PREVIEW_BUSINESS_ID} />
      </main>
    </div>
  );
}
