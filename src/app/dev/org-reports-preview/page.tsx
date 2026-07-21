"use client";

import { useLayoutEffect, useState } from "react";
import { DashboardUIProvider } from "@/components/dashboard/dashboard-context";
import { DashboardSidebarPanel } from "@/components/dashboard/sidebar";
import { OrgReportsHome } from "@/components/reports/org-reports-home";
import { mock } from "@/components/mockup/ui";
import { FileText } from "lucide-react";

const ORG_REPORTS_PREVIEW_BUSINESSES = [
  {
    id: "preview-loc-1",
    name: "Junk Removal Woodbridge",
    account_type: "client",
    is_tracked: true,
    address: "13327 Kirkdale Ct, Woodbridge, VA 22193",
  },
  {
    id: "preview-loc-2",
    name: "Junk Goats Junk Removal",
    account_type: "prospect",
    is_tracked: false,
    address: "Richmond, VA",
  },
  {
    id: "preview-loc-3",
    name: "Long Home",
    account_type: "client",
    is_tracked: true,
    address: "Fairfax, VA",
  },
  {
    id: "preview-loc-4",
    name: "Test Flow",
    account_type: "client",
    is_tracked: true,
    address: "Alexandria, VA",
  },
];

let fetchPatched = false;

function patchOrgReportsPreviewFetch() {
  if (typeof window === "undefined" || fetchPatched) return;
  fetchPatched = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/api/reports/list")) {
      return new Response(
        JSON.stringify({
          drafts: [],
          readyToReview: [],
          published: [],
          recentlyViewed: [],
          archived: [],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    return originalFetch(input, init);
  };
}

export default function OrgReportsPreviewPage() {
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    patchOrgReportsPreviewFetch();
    setReady(true);
  }, []);

  if (!ready) return null;

  return (
    <DashboardUIProvider>
      <div className="flex min-h-screen bg-[#F9FAFB]">
        <DashboardSidebarPanel
          pathname="/reports"
          staticLinks
          showFooter={false}
        />
        <main className="min-w-0 flex-1 overflow-y-auto px-4 py-5 lg:px-6">
          <div className="space-y-5">
            <div className="flex items-start gap-3">
              <span className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#ECFDF3] text-[#137752]">
                <FileText className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h1 className={mock.title}>Reports</h1>
                <p className={mock.subtitle}>
                  A list of reports that are currently available for your organization — some of
                  the cards below are still in development.
                </p>
              </div>
            </div>
            <OrgReportsHome businesses={ORG_REPORTS_PREVIEW_BUSINESSES} />
          </div>
        </main>
      </div>
    </DashboardUIProvider>
  );
}
