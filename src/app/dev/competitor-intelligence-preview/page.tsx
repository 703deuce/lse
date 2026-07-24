"use client";

import { DashboardSidebarPanel } from "@/components/dashboard/sidebar";
import { CompetitorIntelligenceDashboard } from "@/components/reviews/competitor-intelligence-dashboard";
import {
  COMPETITOR_INTELLIGENCE_PREVIEW_BUSINESS_ID,
  competitorIntelligencePreviewData,
} from "@/lib/reviews/competitor-intelligence-preview-data";

export default function CompetitorIntelligencePreviewPage() {
  const path = `/businesses/${COMPETITOR_INTELLIGENCE_PREVIEW_BUSINESS_ID}/reputation/competitors`;

  return (
    <div className="flex min-h-screen bg-[#F9FAFB]">
      <DashboardSidebarPanel
        businessId={COMPETITOR_INTELLIGENCE_PREVIEW_BUSINESS_ID}
        pathname={path}
        businessName="A-Team Junk Removal"
        staticLinks
        showFooter={false}
      />
      <main className="min-w-0 flex-1 overflow-y-auto px-5 py-6 lg:px-8">
        <CompetitorIntelligenceDashboard
          businessId={COMPETITOR_INTELLIGENCE_PREVIEW_BUSINESS_ID}
          data={competitorIntelligencePreviewData}
        />
      </main>
    </div>
  );
}
