"use client";

import { useLayoutEffect, useState } from "react";
import { DashboardUIProvider } from "@/components/dashboard/dashboard-context";
import { DashboardSidebarPanel } from "@/components/dashboard/sidebar";
import { MapsCampaignsList } from "@/components/campaigns/maps-campaigns-list";
import type {
  CampaignListBusiness,
  CampaignListRow,
  CampaignListStats,
} from "@/lib/campaigns/campaign-list-summaries";

const BUSINESS_ID = "e64dbadd-69bb-4715-a526-6d137c0ae409";

const PREVIEW_BUSINESS: CampaignListBusiness = {
  id: BUSINESS_ID,
  name: "Junk Removal Woodbridge",
  websiteUrl: "https://www.junkremovalwoodbridge.com",
  address: "13327 Kirkdale Ct, Woodbridge, VA 22193",
  locationLabel: "Woodbridge",
};

const PREVIEW_CAMPAIGNS: CampaignListRow[] = [
  {
    id: "preview-camp-1",
    name: "Plumbing Repairs",
    description: null,
    schedule_type: "weekly",
    schedule_enabled: true,
    archived_at: null,
    created_at: "2026-02-01T12:00:00.000Z",
    updated_at: "2026-03-12T14:22:00.000Z",
    default_grid_size: 7,
    default_radius_meters: 3000,
    keywordCount: 46,
    status: "active",
    avgPosition: 11.234,
    avgPositionChange: 3.24,
    mapPosition: 10.322,
    mapPositionChange: 5.12,
    rankingsUp: 8,
  },
  {
    id: "preview-camp-2",
    name: "Electronic Repair",
    description: null,
    schedule_type: "weekly",
    schedule_enabled: true,
    archived_at: null,
    created_at: "2026-02-05T12:00:00.000Z",
    updated_at: "2026-03-11T10:00:00.000Z",
    default_grid_size: 7,
    default_radius_meters: 3000,
    keywordCount: 28,
    status: "active",
    avgPosition: 14.102,
    avgPositionChange: 1.84,
    mapPosition: 12.55,
    mapPositionChange: 2.41,
    rankingsUp: 4,
  },
  {
    id: "preview-camp-3",
    name: "Local SEO Expert",
    description: null,
    schedule_type: "biweekly",
    schedule_enabled: true,
    archived_at: null,
    created_at: "2026-01-20T12:00:00.000Z",
    updated_at: "2026-03-08T09:30:00.000Z",
    default_grid_size: 7,
    default_radius_meters: 3000,
    keywordCount: 19,
    status: "active",
    avgPosition: 8.44,
    avgPositionChange: 0.92,
    mapPosition: 7.21,
    mapPositionChange: 1.15,
    rankingsUp: 3,
  },
];

const PREVIEW_STATS: CampaignListStats = {
  totalKeywords: 5,
  activeCampaigns: 3,
  rankingsUp: 12,
  avgRankPosition: 28,
};

let fetchPatched = false;

function patchPreviewFetch() {
  if (typeof window === "undefined" || fetchPatched) return;
  fetchPatched = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes(`/api/campaigns?businessId=${BUSINESS_ID}`)) {
      return new Response(
        JSON.stringify({
          campaigns: PREVIEW_CAMPAIGNS,
          business: PREVIEW_BUSINESS,
          stats: PREVIEW_STATS,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    return originalFetch(input, init);
  };
}

export default function MapsCampaignsListPreviewPage() {
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
          businessName="Junk Removal Woodbridge"
          staticLinks
          showFooter={false}
        />
        <main className="min-w-0 flex-1 overflow-y-auto px-4 py-5 lg:px-6">
          <MapsCampaignsList
            businessId={BUSINESS_ID}
            campaigns={PREVIEW_CAMPAIGNS}
            business={PREVIEW_BUSINESS}
            stats={PREVIEW_STATS}
            onNewCampaign={() => undefined}
          />
        </main>
      </div>
    </DashboardUIProvider>
  );
}
