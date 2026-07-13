"use client";

import { useEffect } from "react";
import { ReviewMomentumDashboard } from "@/components/reviews/review-momentum-dashboard";
import {
  REVIEW_MOMENTUM_PREVIEW_BUSINESS_ID,
  reviewMomentumPreviewPayload,
} from "@/lib/reviews/review-momentum-preview-data";

export default function ReviewMomentumPreviewPage() {
  useEffect(() => {
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
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return (
    <div className="px-5 py-6 lg:px-8">
      <ReviewMomentumDashboard businessId={REVIEW_MOMENTUM_PREVIEW_BUSINESS_ID} />
    </div>
  );
}
