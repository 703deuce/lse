"use client";

import { useLayoutEffect, useState } from "react";
import { DashboardUIProvider } from "@/components/dashboard/dashboard-context";
import { DashboardSidebarPanel } from "@/components/dashboard/sidebar";
import { ProspectAuditDashboard } from "@/components/prospect-audit/prospect-audit-dashboard";
import {
  PROSPECT_AUDIT_PREVIEW_BUSINESS_ID,
  prospectAuditPreviewReport,
} from "@/lib/prospect-audit/preview-data";

let fetchPatched = false;

function patchPreviewFetch() {
  if (typeof window === "undefined" || fetchPatched) return;
  fetchPatched = true;
  const originalFetch = window.fetch.bind(window);
  const bid = PROSPECT_AUDIT_PREVIEW_BUSINESS_ID;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes(`/api/prospect-audits?businessId=${bid}`)) {
      return new Response(JSON.stringify({ report: prospectAuditPreviewReport }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/api/prospect-audits") && init?.method === "POST") {
      return new Response(
        JSON.stringify({ auditId: "preview-audit-1", report: prospectAuditPreviewReport }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    if (url.includes("/api/reports/export")) {
      return new Response(
        JSON.stringify({ ok: true, shareUrl: "https://example.com/share/preview" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    if (url.includes("/api/scans/run-for-keyword") || url.includes("/api/growth-audit/run")) {
      return new Response(JSON.stringify({ ok: true, scan: { id: "preview-scan-1" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return originalFetch(input, init);
  };
}

export default function ProspectAuditPreviewPage() {
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    patchPreviewFetch();
    setReady(true);
  }, []);
  if (!ready) return null;

  return (
    <DashboardUIProvider>
      <div className="flex min-h-screen bg-[#F9FAFB]">
        <DashboardSidebarPanel
          businessId={PROSPECT_AUDIT_PREVIEW_BUSINESS_ID}
          pathname={`/prospects/${PROSPECT_AUDIT_PREVIEW_BUSINESS_ID}/audit`}
          businessName="Plaza Dental"
          staticLinks
          showFooter={false}
        />
        <main className="min-w-0 flex-1 overflow-y-auto px-4 py-5 lg:px-6">
          <ProspectAuditDashboard
            businessId={PROSPECT_AUDIT_PREVIEW_BUSINESS_ID}
            initialReport={prospectAuditPreviewReport}
          />
        </main>
      </div>
    </DashboardUIProvider>
  );
}
