"use client";

import { DashboardHeader } from "@/components/overview/dashboard-header";
import { DashboardQuickActions } from "@/components/overview/dashboard-quick-actions";
import { DashboardRecentScans } from "@/components/overview/dashboard-recent-scans";
import { DashboardFeaturedReports } from "@/components/overview/dashboard-featured-reports";
import { DashboardToolsRow } from "@/components/overview/dashboard-tools-row";
import { ModulePage } from "@/components/ui/design-system";
import type { DashboardScanRow } from "@/lib/overview/load-dashboard-scans";
import type { DashboardFeaturedData } from "@/lib/overview/load-dashboard-featured";

const MOCK_BUSINESS_ID = "preview";

const mockScans: DashboardScanRow[] = [
  {
    id: "scan-1",
    keyword: "junk removal woodbridge",
    keywordId: "kw-1",
    finishedAt: new Date(Date.now() - 86400000).toISOString(),
    gridSize: 7,
    arp: 4.2,
    solv: 42,
    saiv: 38,
    change: 3.3,
    ranks: Array.from({ length: 49 }, (_, i) => (i % 5 === 0 ? 3 : i % 3 === 0 ? 8 : 14)),
    status: "ready",
  },
  {
    id: "scan-2",
    keyword: "junk removal woodbridge",
    keywordId: "kw-1",
    finishedAt: new Date(Date.now() - 172800000).toISOString(),
    gridSize: 7,
    arp: 5.1,
    solv: 38,
    saiv: 35,
    change: -2.8,
    ranks: Array.from({ length: 49 }, (_, i) => (i % 4 === 0 ? 5 : i % 2 === 0 ? 11 : 18)),
    status: "ready",
  },
  {
    id: "scan-3",
    keyword: "junk removal woodbridge",
    keywordId: "kw-1",
    finishedAt: new Date(Date.now() - 259200000).toISOString(),
    gridSize: 3,
    arp: 6.8,
    solv: 22,
    saiv: 20,
    change: 1.1,
    ranks: [2, 5, 8, 4, 12, 9, 15, 7, 11],
    status: "ready",
  },
];

const mockFeatured: DashboardFeaturedData = {
  review: {
    rating: 5.0,
    newReviews90d: 2,
    weeklyPaceGap: 1.5,
    yourSharePct: 24,
    top3SharePct: 58,
    trend: [0, 1, 1, 2, 1, 2],
    hasData: true,
  },
  ai: {
    hasData: true,
    engines: [
      { engine: "chatgpt", label: "ChatGPT", mentioned: true },
      { engine: "gemini", label: "Gemini", mentioned: true },
      { engine: "claude", label: "Claude", mentioned: false },
      { engine: "perplexity", label: "Perplexity", mentioned: false },
    ],
    topMentions: ["Junk King", "College Hunks", "Junk Removal Woodbridge"],
    companyCount: 39,
  },
  local: {
    hasData: true,
    items: [
      { id: "1", title: "Prince William Chamber" },
      { id: "2", title: "Tunnel to Towers" },
      { id: "3", title: "Woodbridge Little League" },
    ],
    total: 21,
  },
};

export default function OverviewPreviewPage() {
  return (
    <ModulePage wide className="!space-y-4 px-5 py-6 lg:px-8">
      <DashboardHeader
        userName="Anthony"
        businessId={MOCK_BUSINESS_ID}
        businessName="Junk Removal Woodbridge"
        businesses={[
          { id: MOCK_BUSINESS_ID, name: "Junk Removal Woodbridge" },
          { id: "b2", name: "Bright Smile Dental" },
        ]}
      />

      <DashboardQuickActions businessId={MOCK_BUSINESS_ID} />

      <DashboardRecentScans businessId={MOCK_BUSINESS_ID} rows={mockScans} total={38} />

      <DashboardFeaturedReports businessId={MOCK_BUSINESS_ID} data={mockFeatured} />

      <DashboardToolsRow businessId={MOCK_BUSINESS_ID} />
    </ModulePage>
  );
}
