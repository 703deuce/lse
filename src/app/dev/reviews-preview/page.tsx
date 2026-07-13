"use client";

import { useState } from "react";
import { ModulePage } from "@/components/ui/design-system";
import { ReviewsOverviewTab } from "@/components/reviews/reviews-overview-tab";
import {
  ReviewsHeader,
  ReviewsKpiRow,
  ReviewsTabs,
  SuggestedActionsSidebar,
  type ReviewsTabId,
} from "@/components/reviews/reviews-ui";
import { REVIEWS_PREVIEW_DATA } from "@/lib/reviews/reviews-preview-data";
import { cn } from "@/lib/utils";

export default function ReviewsPreviewPage() {
  const [tab, setTab] = useState<ReviewsTabId>("overview");
  const data = REVIEWS_PREVIEW_DATA;

  return (
    <div className="flex min-h-screen bg-zinc-100">
      <aside className="hidden w-56 shrink-0 bg-zinc-900 lg:block" aria-hidden />
      <main className="min-w-0 flex-1 overflow-y-auto bg-white px-5 py-6 lg:px-8">
        <ModulePage wide className="!space-y-4">
          <ReviewsHeader
            businessId={data.businessId}
            onRefresh={() => undefined}
            onRunMomentum={() => undefined}
          />
          <ReviewsKpiRow kpis={data.kpis} />
          <ReviewsTabs active={tab} onChange={setTab} />
          <div className={cn("space-y-4")}>
            <div className="min-w-0">
              {tab === "overview" && <ReviewsOverviewTab data={data} onTabChange={setTab} />}
            </div>
            {tab === "overview" && (
              <aside>
                <SuggestedActionsSidebar
                  suggestions={data.suggestions}
                  businessId={data.businessId}
                  onTabChange={setTab}
                />
              </aside>
            )}
          </div>
        </ModulePage>
      </main>
    </div>
  );
}
