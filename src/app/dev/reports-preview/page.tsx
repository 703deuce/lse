"use client";

import { useLayoutEffect, useState } from "react";
import { DashboardUIProvider } from "@/components/dashboard/dashboard-context";
import { DashboardSidebarPanel } from "@/components/dashboard/sidebar";
import { ReportsHub } from "@/components/reports/reports-hub";
import {
  REPORTS_PREVIEW_BUSINESS_ID,
  reportsPreviewOptions,
  reportsPreviewScans,
} from "@/lib/reporting/reports-preview-data";

let fetchPatched = false;

function patchReportsPreviewFetch() {
  if (typeof window === "undefined" || fetchPatched) return;
  fetchPatched = true;
  const originalFetch = window.fetch.bind(window);
  const bid = REPORTS_PREVIEW_BUSINESS_ID;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (url.includes(`/api/reports/scans`) && url.includes(bid)) {
      return new Response(JSON.stringify(reportsPreviewScans), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes(`/api/reports/options`) && url.includes(bid)) {
      return new Response(JSON.stringify(reportsPreviewOptions), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/api/reports/export") || url.includes("/api/reports/artifacts")) {
      return new Response(JSON.stringify({ ok: true, queued: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/api/jobs/")) {
      return new Response(JSON.stringify({ status: "completed", result: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return originalFetch(input, init);
  };
}

export default function ReportsPreviewPage() {
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    patchReportsPreviewFetch();
    setReady(true);
  }, []);

  if (!ready) return null;

  return (
    <DashboardUIProvider>
      <div className="flex min-h-screen bg-[#F9FAFB]">
        <DashboardSidebarPanel
          businessId={REPORTS_PREVIEW_BUSINESS_ID}
          pathname={`/businesses/${REPORTS_PREVIEW_BUSINESS_ID}/reports`}
          businessName="Junk Removal Woodbridge"
          staticLinks
          showFooter={false}
        />
        <main className="min-w-0 flex-1 overflow-y-auto px-4 py-5 lg:px-6">
          <ReportsHub
            businessId={REPORTS_PREVIEW_BUSINESS_ID}
            latestScanId={reportsPreviewScans.scans[0]?.id ?? null}
          />
        </main>
      </div>
    </DashboardUIProvider>
  );
}
