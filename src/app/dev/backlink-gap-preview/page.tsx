"use client";

import { useLayoutEffect, useState } from "react";
import { BacklinkGapDashboard } from "@/components/backlink-gap/backlink-gap-dashboard";
import {
  BACKLINK_GAP_PREVIEW_BUSINESS_ID,
  backlinkGapPreviewCounts,
  backlinkGapPreviewMain,
  backlinkGapPreviewMatrix,
  backlinkGapPreviewOpportunities,
  backlinkGapPreviewStats,
} from "@/lib/backlink-gap/backlink-gap-preview-data";

let fetchPatched = false;

function patchBacklinkGapPreviewFetch() {
  if (typeof window === "undefined" || fetchPatched) return;
  fetchPatched = true;
  const originalFetch = window.fetch.bind(window);
  const bid = BACKLINK_GAP_PREVIEW_BUSINESS_ID;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (url.includes(`/api/backlink-gap/${bid}`) && !url.includes("/opportunities") && !url.includes("/stats") && !url.includes("/matrix") && !url.includes("/counts")) {
      return new Response(JSON.stringify(backlinkGapPreviewMain), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes(`/api/backlink-gap/${bid}/stats`)) {
      return new Response(JSON.stringify(backlinkGapPreviewStats), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes(`/api/backlink-gap/${bid}/opportunities`)) {
      return new Response(JSON.stringify(backlinkGapPreviewOpportunities(url)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes(`/api/backlink-gap/${bid}/matrix`)) {
      return new Response(JSON.stringify(backlinkGapPreviewMatrix), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes(`/api/backlink-gap/${bid}/counts`)) {
      return new Response(JSON.stringify(backlinkGapPreviewCounts), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/api/backlink-gap/run") || url.includes("/api/backlink-gap/tasks/create") || url.includes("/api/backlink-gap/opportunity/update")) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    return originalFetch(input, init);
  };
}

export default function BacklinkGapPreviewPage() {
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    patchBacklinkGapPreviewFetch();
    setReady(true);
  }, []);

  if (!ready) return null;

  return (
    <div className="px-5 py-6 lg:px-8">
      <BacklinkGapDashboard businessId={BACKLINK_GAP_PREVIEW_BUSINESS_ID} />
    </div>
  );
}
