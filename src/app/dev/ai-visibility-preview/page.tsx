"use client";

import { useLayoutEffect, useState } from "react";
import { DashboardSidebarPanel } from "@/components/dashboard/sidebar";
import { AiVisibilityDashboard } from "@/components/ai-visibility/ai-visibility-dashboard";
import {
  AI_VISIBILITY_PREVIEW_BUSINESS_ID,
  aiVisibilityPreviewPayload,
} from "@/lib/ai-visibility/ai-visibility-preview-data";

let fetchPatched = false;

function patchAiVisibilityPreviewFetch() {
  if (typeof window === "undefined" || fetchPatched) return;
  fetchPatched = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes(`/api/ai-visibility/${AI_VISIBILITY_PREVIEW_BUSINESS_ID}`)) {
      return new Response(JSON.stringify(aiVisibilityPreviewPayload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/api/ai-visibility/run")) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    return originalFetch(input, init);
  };
}

export default function AiVisibilityPreviewPage() {
  const [ready, setReady] = useState(false);
  const path = `/businesses/${AI_VISIBILITY_PREVIEW_BUSINESS_ID}/ai-visibility`;

  useLayoutEffect(() => {
    patchAiVisibilityPreviewFetch();
    setReady(true);
  }, []);

  if (!ready) return null;

  return (
    <div className="flex min-h-screen bg-[#F9FAFB]">
      <DashboardSidebarPanel
        businessId={AI_VISIBILITY_PREVIEW_BUSINESS_ID}
        pathname={path}
        businessName="Junk Removal Woodbridge"
        staticLinks
        showFooter={false}
      />
      <main className="min-w-0 flex-1 overflow-y-auto px-5 py-6 lg:px-8">
        <AiVisibilityDashboard businessId={AI_VISIBILITY_PREVIEW_BUSINESS_ID} />
      </main>
    </div>
  );
}
