"use client";

import { useLayoutEffect, useState } from "react";
import { DashboardUIProvider } from "@/components/dashboard/dashboard-context";
import { DashboardSidebarPanel } from "@/components/dashboard/sidebar";
import {
  CampaignSetupWizard,
  MapsCampaignsWizardPageHeader,
} from "@/components/campaigns/campaign-setup-wizard";

const BUSINESS_ID = "e64dbadd-69bb-4715-a526-6d137c0ae409";

const PREVIEW_EXISTING = [
  {
    id: "preview-existing-1",
    name: "Fitness network",
    schedule_type: "weekly",
    keywordCount: 10,
    default_grid_size: 13,
    updated_at: "2024-05-24T12:43:00.000Z",
    status: "active" as const,
    locationLabel: "Chicago, Illinois",
  },
];

let fetchPatched = false;

function patchPreviewFetch() {
  if (typeof window === "undefined" || fetchPatched) return;
  fetchPatched = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (url.includes(`/api/businesses/${BUSINESS_ID}/account`)) {
      return new Response(
        JSON.stringify({
          account: {
            id: BUSINESS_ID,
            name: "Soft Renewal Store",
            address_text: "1200 W Madison St, Chicago, IL 60607",
            scan_center_label: "Chicago, IL",
            website_url: "https://softrenewal.example",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (url.includes("/api/campaigns") && (!init?.method || init.method === "GET")) {
      return new Response(
        JSON.stringify({ campaigns: PREVIEW_EXISTING }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (url.includes("/api/campaigns") && init?.method === "POST") {
      return new Response(
        JSON.stringify({ campaign: { id: "preview-new-campaign" } }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (url.includes("/api/scans/keywords/add") || url.includes("/api/scans/run-for-keyword")) {
      return new Response(JSON.stringify({ ok: true, keyword: { id: "kw-1" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return originalFetch(input, init);
  };
}

export default function MapsCampaignsWizardPreviewPage() {
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
          businessId={BUSINESS_ID}
          pathname={`/businesses/${BUSINESS_ID}/campaigns`}
          businessName="Soft Renewal Store"
          staticLinks
          showFooter={false}
        />
        <main className="min-w-0 flex-1 overflow-y-auto px-4 py-5 lg:px-6">
          <div className="space-y-5">
            <MapsCampaignsWizardPageHeader />
            <CampaignSetupWizard
              businessId={BUSINESS_ID}
              existingCampaigns={PREVIEW_EXISTING}
              onClose={() => undefined}
            />
          </div>
        </main>
      </div>
    </DashboardUIProvider>
  );
}
