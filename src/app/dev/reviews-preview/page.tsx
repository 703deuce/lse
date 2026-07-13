"use client";

import { useState, type ComponentType } from "react";
import { Building2, MapPin } from "lucide-react";
import { ModulePage } from "@/components/ui/design-system";
import { buildBusinessSidebarNav } from "@/components/dashboard/dashboard-nav";
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

function PreviewSidebar({ businessId, activeHref }: { businessId: string; activeHref: string }) {
  const nav = buildBusinessSidebarNav(businessId);

  const renderItem = (href: string, label: string, Icon: ComponentType<{ className?: string }>) => {
    const active = href === activeHref;
    return (
      <div
        key={href}
        className={cn(
          "relative flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[13px] font-medium",
          active ? "bg-emerald-500/15 pl-3.5 text-emerald-300" : "text-sidebar-text"
        )}
      >
        {active && (
          <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-emerald-500" />
        )}
        <Icon className={cn("h-4 w-4 shrink-0", active ? "text-emerald-400" : "text-sidebar-text-muted")} />
        {label}
      </div>
    );
  };

  const renderSection = (title: string, items: Array<{ href: string; label: string; icon: ComponentType<{ className?: string }> }>) => (
    <div className="mb-2">
      <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-text-muted">{title}</p>
      <div className="space-y-0.5">{items.map((item) => renderItem(item.href, item.label, item.icon))}</div>
    </div>
  );

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
      <nav className="flex-1 overflow-y-auto p-2.5">
        <div className="mt-3 border-t border-sidebar-border pt-3">
          {renderSection(nav.main.title, nav.main.items)}
          <div className="mb-2">
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-text-muted">
              {nav.reputation.title}
            </p>
            <div className="space-y-0.5">
              {nav.reputation.items.map((item) => renderItem(item.href, item.label, item.icon))}
              {nav.reputation.subLinks.map((item) => (
                <div
                  key={item.href}
                  className={cn(
                    "relative py-1.5 pl-8 pr-3 text-[13px] font-medium",
                    item.href === activeHref ? "text-emerald-300" : "text-sidebar-text"
                  )}
                >
                  {item.label}
                </div>
              ))}
            </div>
          </div>
          {renderSection(nav.research.title, nav.research.items)}
          {renderSection(nav.reports.title, nav.reports.items)}
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
      <PreviewSidebar businessId={data.businessId} activeHref={`/businesses/${data.businessId}/reviews`} />
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
