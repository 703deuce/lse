"use client";

import { useLayoutEffect, useState } from "react";
import { KeywordTrackerDashboard } from "@/components/keyword-tracker/keyword-dashboard";
import {
  KEYWORDS_PREVIEW_BUSINESS_ID,
  keywordsPreviewData,
} from "@/lib/keyword-tracker/keywords-preview-data";

let fetchPatched = false;

function patchKeywordsPreviewFetch() {
  if (typeof window === "undefined" || fetchPatched) return;
  fetchPatched = true;
  const originalFetch = window.fetch.bind(window);
  const bid = KEYWORDS_PREVIEW_BUSINESS_ID;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();

    if (url.includes(`/api/keywords/${bid}`) && method === "GET") {
      return new Response(JSON.stringify(keywordsPreviewData), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (
      url.includes("/api/keywords/add") ||
      url.includes("/api/keywords/check") ||
      url.includes("/api/keywords/volume") ||
      url.includes("/api/keywords/suggest") ||
      url.includes("/api/keywords/remove")
    ) {
      return new Response(JSON.stringify({ ok: true, ...keywordsPreviewData }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return originalFetch(input, init);
  };
}

export default function KeywordsPreviewPage() {
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    patchKeywordsPreviewFetch();
    setReady(true);
  }, []);

  if (!ready) return null;

  return (
    <div className="px-5 py-6 lg:px-8">
      <KeywordTrackerDashboard businessId={KEYWORDS_PREVIEW_BUSINESS_ID} />
    </div>
  );
}
