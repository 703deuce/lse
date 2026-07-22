"use client";

import { useLayoutEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { DashboardUIProvider } from "@/components/dashboard/dashboard-context";
import { DashboardSidebarPanel } from "@/components/dashboard/sidebar";
import { ProspectAuditDashboard } from "@/components/prospect-audit/prospect-audit-dashboard";
import {
  PROSPECT_AUDIT_PREVIEW_BUSINESS_ID,
  prospectAuditPreviewReport,
  prospectAuditRunningPreviewReport,
  prospectAuditSetupPreviewReport,
} from "@/lib/prospect-audit/preview-data";
import type { ProspectAuditReport } from "@/lib/prospect-audit/types";

let fetchPatched = false;

function reportForState(state: string | null): ProspectAuditReport {
  if (state === "setup") return prospectAuditSetupPreviewReport;
  if (state === "running") return prospectAuditRunningPreviewReport;
  return prospectAuditPreviewReport;
}

function patchPreviewFetch(getReport: () => ProspectAuditReport) {
  if (typeof window === "undefined" || fetchPatched) return;
  fetchPatched = true;
  const originalFetch = window.fetch.bind(window);
  const bid = PROSPECT_AUDIT_PREVIEW_BUSINESS_ID;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes(`/api/prospect-audits?businessId=${bid}`)) {
      return new Response(JSON.stringify({ report: getReport() }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/api/prospect-audits") && init?.method === "POST") {
      return new Response(
        JSON.stringify({
          auditId: "preview-audit-1",
          report: { ...getReport(), status: "running" },
        }),
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

function ProspectAuditPreviewInner() {
  const searchParams = useSearchParams();
  const state = searchParams.get("state");
  const report = useMemo(() => reportForState(state), [state]);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    patchPreviewFetch(() => reportForState(state));
    setReady(true);
  }, [state]);

  if (!ready) return null;

  const bizName = report.business.name;

  return (
    <DashboardUIProvider>
      <div className="flex min-h-screen bg-[#F9FAFB]">
        <DashboardSidebarPanel
          businessId={PROSPECT_AUDIT_PREVIEW_BUSINESS_ID}
          pathname={
            state === "setup" || state === "running"
              ? `/prospects/${PROSPECT_AUDIT_PREVIEW_BUSINESS_ID}/audit`
              : `/prospects/${PROSPECT_AUDIT_PREVIEW_BUSINESS_ID}/audit`
          }
          businessName={bizName}
          staticLinks
          showFooter={false}
        />
        <main className="min-w-0 flex-1 overflow-y-auto px-4 py-5 lg:px-6">
          <ProspectAuditDashboard
            businessId={PROSPECT_AUDIT_PREVIEW_BUSINESS_ID}
            initialReport={report}
          />
        </main>
      </div>
    </DashboardUIProvider>
  );
}

export default function ProspectAuditPreviewPage() {
  return (
    <Suspense fallback={null}>
      <ProspectAuditPreviewInner />
    </Suspense>
  );
}
