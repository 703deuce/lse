"use client";

import { DashboardUIProvider } from "@/components/dashboard/dashboard-context";
import { DashboardSidebarPanel } from "@/components/dashboard/sidebar";
import {
  MapsCampaignsLocationHub,
  type HubLocation,
} from "@/components/campaigns/maps-campaigns-location-hub";

const PREVIEW_LOCATIONS: HubLocation[] = [
  {
    id: "preview-loc-1",
    name: "Local SEO - Real Estate & Local Rankings",
    accountType: "client",
    isTracked: true,
    address: "Woodbridge, VA",
    campaignCount: 2,
    keywordCount: 8,
    activeCampaignCount: 2,
    pausedCampaignCount: 0,
    archivedCampaignCount: 0,
    latestCampaignName: "Primary keywords",
    latestCampaignId: "preview-camp-1",
    latestUpdatedAt: "2026-03-12T14:22:00.000Z",
    status: "active",
  },
  {
    id: "preview-loc-2",
    name: "Junk Removal Woodbridge",
    accountType: "client",
    isTracked: true,
    address: "13327 Kirkdale Ct, Woodbridge, VA",
    campaignCount: 1,
    keywordCount: 5,
    activeCampaignCount: 1,
    pausedCampaignCount: 0,
    archivedCampaignCount: 0,
    latestCampaignName: "Weekly Maps",
    latestCampaignId: "preview-camp-2",
    latestUpdatedAt: "2026-03-10T09:15:00.000Z",
    status: "active",
  },
  {
    id: "preview-loc-3",
    name: "Junk Goats Junk Removal",
    accountType: "prospect",
    isTracked: false,
    address: "Richmond, VA",
    campaignCount: 1,
    keywordCount: 3,
    activeCampaignCount: 0,
    pausedCampaignCount: 1,
    archivedCampaignCount: 0,
    latestCampaignName: "Baseline",
    latestCampaignId: "preview-camp-3",
    latestUpdatedAt: "2026-02-28T16:40:00.000Z",
    status: "paused",
  },
  {
    id: "preview-loc-4",
    name: "Long Home",
    accountType: "client",
    isTracked: true,
    address: "Fairfax, VA",
    campaignCount: 1,
    keywordCount: 4,
    activeCampaignCount: 1,
    pausedCampaignCount: 0,
    archivedCampaignCount: 0,
    latestCampaignName: "Home services",
    latestCampaignId: "preview-camp-4",
    latestUpdatedAt: "2026-03-01T11:05:00.000Z",
    status: "active",
  },
];

export default function MapsCampaignsHubPreviewPage() {
  return (
    <DashboardUIProvider>
      <div className="flex min-h-screen bg-[#F9FAFB]">
        <DashboardSidebarPanel
          pathname="/tools/go/maps-campaigns"
          businessName="Independent consultants"
          staticLinks
          showFooter={false}
        />
        <main className="min-w-0 flex-1 overflow-y-auto px-4 py-5 lg:px-6">
          <MapsCampaignsLocationHub
            locations={PREVIEW_LOCATIONS}
            totalCampaigns={5}
            completedRuns={0}
            mapCreditsRemaining={19890}
            mapCreditsLimit={50000}
          />
        </main>
      </div>
    </DashboardUIProvider>
  );
}
