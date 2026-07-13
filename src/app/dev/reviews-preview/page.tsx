"use client";

import { useState } from "react";
import { Building2, LayoutDashboard, MapPin, Star, TrendingUp } from "lucide-react";
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

function PreviewSidebar() {
  const links = [
    { label: "Overview", icon: LayoutDashboard, active: false },
    { label: "Reviews", icon: Star, active: true },
    { label: "Review Momentum™", icon: TrendingUp, active: false },
  ];

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="border-b border-sidebar-border px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600">
            <MapPin className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">Maps Growth Agent</p>
            <p className="text-[11px] text-sidebar-text-muted">Local SEO Platform</p>
          </div>
        </div>
        <div className="mx-1 mt-2.5 flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-slate-300">
          <Building2 className="h-3.5 w-3.5 shrink-0 text-sidebar-text-muted" />
          <span className="min-w-0 flex-1 truncate">Bright Smile Dental</span>
        </div>
      </div>
      <nav className="flex-1 p-2.5">
        <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-text-muted">Main</p>
        <div className="space-y-0.5">
          {links.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className={cn(
                  "relative flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[13px] font-medium",
                  item.active
                    ? "bg-emerald-500/15 pl-3.5 text-emerald-300"
                    : "text-sidebar-text"
                )}
              >
                {item.active && (
                  <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-emerald-500" />
                )}
                <Icon className={cn("h-4 w-4 shrink-0", item.active ? "text-emerald-400" : "text-sidebar-text-muted")} />
                {item.label}
              </div>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}

export default function ReviewsPreviewPage() {
  const [tab, setTab] = useState<ReviewsTabId>("overview");
  const data = REVIEWS_PREVIEW_DATA;

  return (
    <div className="flex min-h-screen bg-surface-muted">
      <PreviewSidebar />
      <main className="min-w-0 flex-1 overflow-y-auto px-5 py-6 lg:px-8">
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
