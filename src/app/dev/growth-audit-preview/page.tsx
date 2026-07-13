"use client";

import { useLayoutEffect, useState } from "react";
import { GrowthAuditActionPlanTab } from "@/components/growth-audit/growth-audit-action-plan-tab";
import { GrowthAuditCompetitorTab } from "@/components/growth-audit/growth-audit-competitor-tab";
import { GrowthAuditCoverageTab } from "@/components/growth-audit/growth-audit-coverage-tab";
import { GrowthAuditGbpTab } from "@/components/growth-audit/growth-audit-gbp-tab";
import { GrowthAuditOverviewTab } from "@/components/growth-audit/growth-audit-overview-tab";
import {
  GrowthAuditHeader,
  GrowthAuditTabs,
  type GrowthAuditTabId,
} from "@/components/growth-audit/growth-audit-ui";
import { GrowthAuditWebsiteTab } from "@/components/growth-audit/growth-audit-website-tab";
import { ModulePage } from "@/components/ui/design-system";
import {
  GROWTH_AUDIT_PREVIEW_BUSINESS_ID,
  growthAuditPreviewApi,
  growthAuditPreviewMomentum,
  growthAuditPreviewSections,
} from "@/lib/growth-audit/growth-audit-preview-data";

let fetchPatched = false;

function patchGrowthAuditPreviewFetch() {
  if (typeof window === "undefined" || fetchPatched) return;
  fetchPatched = true;
  const originalFetch = window.fetch.bind(window);
  const bid = GROWTH_AUDIT_PREVIEW_BUSINESS_ID;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (url.includes(`/api/growth-audit/${bid}/status`)) {
      return new Response(
        JSON.stringify({
          status: growthAuditPreviewApi.run.status,
          extended: growthAuditPreviewApi.run.extended,
          progressStage: null,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    if (url.includes(`/api/growth-audit/${bid}`)) {
      return new Response(JSON.stringify(growthAuditPreviewApi), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/api/growth-audit/run")) {
      return new Response(
        JSON.stringify({
          status: "complete",
          growthScore: growthAuditPreviewApi.run.growthScore,
          sections: growthAuditPreviewSections,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    if (url.includes("/api/reviews/momentum/latest")) {
      return new Response(JSON.stringify(growthAuditPreviewMomentum), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return originalFetch(input, init);
  };
}

export default function GrowthAuditPreviewPage() {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<GrowthAuditTabId>("overview");
  const sections = growthAuditPreviewSections;
  const score = sections.overview.growthScore;

  useLayoutEffect(() => {
    patchGrowthAuditPreviewFetch();
    setReady(true);
  }, []);

  if (!ready) return null;

  return (
    <div className="px-5 py-6 lg:px-8">
      <ModulePage wide className="!space-y-4">
        <GrowthAuditHeader
          startedAt={growthAuditPreviewApi.run.startedAt}
          running={false}
          onRun={() => undefined}
        />
        <GrowthAuditTabs tab={tab} onTabChange={setTab} />

        {tab === "overview" && (
          <GrowthAuditOverviewTab
            businessId={GROWTH_AUDIT_PREVIEW_BUSINESS_ID}
            sections={sections}
            growthScore={score}
            onGoToActionPlan={() => setTab("growth-plan")}
          />
        )}
        {tab === "gbp" && (
          <GrowthAuditGbpTab gbp={sections.gbp} onGoToActionPlan={() => setTab("growth-plan")} />
        )}
        {tab === "website" && (
          <GrowthAuditWebsiteTab
            website={sections.website}
            onGoToActionPlan={() => setTab("growth-plan")}
          />
        )}
        {tab === "coverage" && <GrowthAuditCoverageTab sections={sections} />}
        {tab === "competitor-gap" && (
          <GrowthAuditCompetitorTab
            sections={sections}
            businessName={sections.gbp.profile.name}
            onGoToActionPlan={() => setTab("growth-plan")}
          />
        )}
        {tab === "growth-plan" && (
          <GrowthAuditActionPlanTab
            sections={sections}
            onGoToOverview={() => setTab("overview")}
          />
        )}
      </ModulePage>
    </div>
  );
}
