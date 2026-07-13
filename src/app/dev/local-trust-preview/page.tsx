"use client";

import { useLayoutEffect, useState } from "react";
import { LocalTrustDashboard } from "@/components/local-trust/local-trust-dashboard";
import {
  LOCAL_TRUST_PREVIEW_BUSINESS_ID,
  localTrustPreviewCounts,
  localTrustPreviewMain,
  localTrustPreviewMarkets,
  localTrustPreviewOpportunities,
  localTrustPreviewRuns,
} from "@/lib/local-trust/local-trust-preview-data";

let fetchPatched = false;

function patchLocalTrustPreviewFetch() {
  if (typeof window === "undefined" || fetchPatched) return;
  fetchPatched = true;
  const originalFetch = window.fetch.bind(window);
  const bid = LOCAL_TRUST_PREVIEW_BUSINESS_ID;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (url.includes(`/api/trust/${bid}/opportunities`)) {
      return new Response(JSON.stringify(localTrustPreviewOpportunities(url)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes(`/api/trust/${bid}/counts`)) {
      return new Response(JSON.stringify(localTrustPreviewCounts), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes(`/api/trust/${bid}/markets`) && url.includes("view=runs")) {
      return new Response(JSON.stringify(localTrustPreviewRuns), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes(`/api/trust/${bid}/markets`)) {
      return new Response(JSON.stringify(localTrustPreviewMarkets), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes(`/api/trust/${bid}`) && !url.includes("/opportunities") && !url.includes("/counts") && !url.includes("/markets")) {
      return new Response(JSON.stringify(localTrustPreviewMain), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/api/trust/run") || url.includes("/api/trust/tasks/create")) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    return originalFetch(input, init);
  };
}

export default function LocalTrustPreviewPage() {
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    patchLocalTrustPreviewFetch();
    setReady(true);
  }, []);

  if (!ready) return null;

  return (
    <div className="px-5 py-6 lg:px-8">
      <LocalTrustDashboard businessId={LOCAL_TRUST_PREVIEW_BUSINESS_ID} />
    </div>
  );
}
