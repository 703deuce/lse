"use client";

import { DashboardHeader } from "@/components/overview/dashboard-header";
import { DashboardQuickActions } from "@/components/overview/dashboard-quick-actions";
import { DashboardRecentScans } from "@/components/overview/dashboard-recent-scans";
import {
  OverviewAuditSnapshot,
  OverviewCoreScores,
  OverviewFooterCta,
  OverviewRecommendedActions,
} from "@/components/overview/overview-sections";
import { OverviewMomentumCard } from "@/components/overview/overview-momentum-card";
import { ModulePage } from "@/components/ui/design-system";
import type { DashboardScanRow } from "@/lib/overview/load-dashboard-scans";

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

const coreScores = [
  { label: "Growth Score", value: 72, href: `/businesses/${MOCK_BUSINESS_ID}/growth-audit` },
  { label: "Maps Score", value: 68, href: `/businesses/${MOCK_BUSINESS_ID}/scans` },
  { label: "Review Momentum™", value: 81, href: `/businesses/${MOCK_BUSINESS_ID}/review-momentum` },
  { label: "Grid Visibility", value: 64, href: `/businesses/${MOCK_BUSINESS_ID}/scans` },
];

export default function OverviewPreviewPage() {
  return (
    <ModulePage wide className="!space-y-4 px-5 py-6 lg:px-8">
      <DashboardHeader
        userName="Anthony"
        businessName="Junk Removal Woodbridge"
        businessId={MOCK_BUSINESS_ID}
      />

      <DashboardQuickActions businessId={MOCK_BUSINESS_ID} />

      <DashboardRecentScans businessId={MOCK_BUSINESS_ID} rows={mockScans} total={38} />

      <OverviewCoreScores businessId={MOCK_BUSINESS_ID} scores={coreScores} />

      <OverviewMomentumCard
        businessId={MOCK_BUSINESS_ID}
        hasData
        momentumScore={81}
        momentumLabel="Healthy"
        weeklyPaceGap={3}
        targetSharePct={24}
        reviews30d={12}
        marketPotential="Medium"
        chartData={[
          { label: "Jun 1", value: 2 },
          { label: "Jun 8", value: 4 },
          { label: "Jun 15", value: 3 },
          { label: "Jun 22", value: 6 },
          { label: "Jun 29", value: 5 },
          { label: "Jul 6", value: 8 },
        ]}
        alertMessage="Your review momentum is healthy. Stay consistent to maintain your edge."
      />

      <OverviewAuditSnapshot
        scores={[
          { label: "Overall", value: 72 },
          { label: "Relevance", value: 78 },
          { label: "Distance", value: 65 },
          { label: "Prominence", value: 70 },
          { label: "Trust", value: 74 },
        ]}
      />

      <OverviewRecommendedActions
        businessId={MOCK_BUSINESS_ID}
        items={[
          {
            id: "1",
            title: "Add service-area pages",
            description: "Create landing pages for your top neighborhoods.",
            impact: "high",
          },
          {
            id: "2",
            title: "Request reviews from recent customers",
            description: "Send review requests to customers from the last 30 days.",
            impact: "high",
          },
          {
            id: "3",
            title: "Fix NAP inconsistencies",
            description: "Update directory listings with correct business info.",
            impact: "medium",
          },
        ]}
      />

      <OverviewFooterCta businessId={MOCK_BUSINESS_ID} />
    </ModulePage>
  );
}
