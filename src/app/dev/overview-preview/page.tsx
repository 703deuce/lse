"use client";

import { OverviewMomentumCard } from "@/components/overview/overview-momentum-card";
import {
  OverviewAuditSnapshot,
  OverviewCoreScores,
  OverviewFooterCta,
  OverviewRecommendedActions,
} from "@/components/overview/overview-sections";
import { ModulePage } from "@/components/ui/design-system";

const MOCK_BUSINESS_ID = "preview";

const coreScores = [
  { label: "Growth Score", value: 72, href: `/businesses/${MOCK_BUSINESS_ID}/growth-audit` },
  { label: "Maps Score", value: 68, href: `/businesses/${MOCK_BUSINESS_ID}/scans` },
  { label: "Review Momentum™", value: 81, href: `/businesses/${MOCK_BUSINESS_ID}/review-momentum` },
  { label: "Grid Visibility", value: 64, href: `/businesses/${MOCK_BUSINESS_ID}/scans` },
];

const auditScores = [
  { label: "Overall", value: 72 },
  { label: "Relevance", value: 78 },
  { label: "Distance", value: 65 },
  { label: "Prominence", value: 70 },
  { label: "Trust", value: 74 },
];

const recommendedItems = [
  {
    id: "1",
    title: "Add service-area pages",
    description: "Create landing pages for your top neighborhoods to improve local relevance.",
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
    description: "Update directory listings with your correct business name, address, and phone.",
    impact: "medium",
  },
];

export default function OverviewPreviewPage() {
  return (
    <ModulePage wide className="!space-y-4 px-5 py-6 lg:px-8">
      <div>
        <h1 className="text-xl font-semibold text-text">Overview</h1>
        <p className="mt-0.5 text-sm text-text-muted">Bright Smile Dental · Dentist</p>
      </div>

      <section>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <p className="text-sm font-semibold text-text">Google Maps Growth Audit</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-text">72/100</p>
            <p className="mt-3 text-xs text-text-muted">Last run: Jun 10, 2026</p>
          </div>
          <div className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <p className="text-sm font-semibold text-text">Citation Health</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-text">88/100</p>
            <p className="mt-3 text-xs text-text-muted">12 listings verified</p>
          </div>
          <div className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <p className="text-sm font-semibold text-text">Reputation Health</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-text">4.8 ★</p>
            <p className="mt-3 text-xs text-text-muted">123 total reviews</p>
          </div>
        </div>
      </section>

      <section>
        <OverviewCoreScores businessId={MOCK_BUSINESS_ID} scores={coreScores} />
      </section>

      <section>
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
      </section>

      <section>
        <OverviewAuditSnapshot scores={auditScores} />
      </section>

      <section>
        <OverviewRecommendedActions businessId={MOCK_BUSINESS_ID} items={recommendedItems} />
      </section>

      <section>
        <OverviewFooterCta businessId={MOCK_BUSINESS_ID} />
      </section>
    </ModulePage>
  );
}
