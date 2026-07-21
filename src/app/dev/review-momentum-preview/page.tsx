"use client";

import { useLayoutEffect, useState } from "react";
import { DashboardSidebarPanel } from "@/components/dashboard/sidebar";
import { ReviewMomentumDashboard } from "@/components/reviews/review-momentum-dashboard";
import {
  REVIEW_MOMENTUM_PREVIEW_BUSINESS_ID,
  reviewMomentumPreviewPayload,
} from "@/lib/reviews/review-momentum-preview-data";

let fetchPatched = false;

function patchMomentumPreviewFetch() {
  if (typeof window === "undefined" || fetchPatched) return;
  fetchPatched = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes(`/api/reviews/momentum/latest?businessId=${REVIEW_MOMENTUM_PREVIEW_BUSINESS_ID}`)) {
      return new Response(JSON.stringify(reviewMomentumPreviewPayload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/api/reviews/momentum/run")) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    if (url.includes("/api/reviews/momentum/tasks/")) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    return originalFetch(input, init);
  };
}

export default function ReviewMomentumPreviewPage() {
  const [ready, setReady] = useState(false);
  const path = `/businesses/${REVIEW_MOMENTUM_PREVIEW_BUSINESS_ID}/review-momentum`;

  useLayoutEffect(() => {
    patchMomentumPreviewFetch();
    setReady(true);
  }, []);

  if (!ready) return null;

  return (
    <div className="flex min-h-screen bg-[#F9FAFB]">
      <DashboardSidebarPanel
        businessId={REVIEW_MOMENTUM_PREVIEW_BUSINESS_ID}
        pathname={path}
        businessName="Junk Removal Woodbridge"
        staticLinks
        showFooter={false}
      />
      <main className="min-w-0 flex-1 overflow-y-auto px-5 py-6 lg:px-8">
        <ReviewMomentumDashboard businessId={REVIEW_MOMENTUM_PREVIEW_BUSINESS_ID} />
      </main>
    </div>
  );
}
