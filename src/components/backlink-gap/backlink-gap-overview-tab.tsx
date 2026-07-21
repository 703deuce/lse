"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CheckCircle2, Lightbulb, Target } from "lucide-react";
import type { EnrichedOpportunity } from "@/components/backlink-gap/opportunities-panel";
import { PanelCard, priorityBadge } from "@/components/backlink-gap/backlink-gap-ui";
import { dashboardAccentLink, dashboardBody, dashboardMicro } from "@/components/overview/dashboard-ui";
import { ContentCard, InsightPanel } from "@/components/ui/design-system";

type Analytics = {
  linkTypes: { dofollow: number; nofollow: number; unknown: number };
  priorities: { high: number; medium: number; low: number };
  sourceTypes: Array<{ name: string; count: number }>;
  powerBuckets: Array<{ label: string; count: number }>;
};

const PIE_COLORS = ["#16A34A", "#3b82f6", "#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899", "#64748b", "#84cc16"];

function panelFooterLink(label: string, onClick?: () => void) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[12px] font-medium text-emerald-700 hover:underline"
    >
      {label}
    </button>
  );
}

export function BacklinkGapOverviewTab({
  businessId,
  aiSummary,
  topOpportunities,
  onSelect,
  onViewOpportunities,
  onViewTasks,
}: {
  businessId: string;
  aiSummary: string | null;
  topOpportunities: EnrichedOpportunity[];
  onSelect: (o: EnrichedOpportunity) => void;
  onViewOpportunities?: () => void;
  onViewTasks?: () => void;
}) {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);

  useEffect(() => {
    fetch(`/api/backlink-gap/${businessId}/stats`)
      .then((r) => r.json())
      .then((json) => setAnalytics(json))
      .catch(() => setAnalytics(null));
  }, [businessId]);

  const linkTypeData = analytics
    ? [
        { name: "Dofollow", value: analytics.linkTypes.dofollow, color: "#16A34A" },
        { name: "Nofollow", value: analytics.linkTypes.nofollow, color: "#3b82f6" },
        { name: "Unknown", value: analytics.linkTypes.unknown, color: "#94a3b8" },
      ].filter((d) => d.value > 0)
    : [];

  const categoryData = (analytics?.sourceTypes ?? []).slice(0, 6);
  const categoryTotal = categoryData.reduce((s, d) => s + d.count, 0);
  const linkTypeTotal = linkTypeData.reduce((s, d) => s + d.value, 0);
  const totalOpps = analytics?.priorities
    ? analytics.priorities.high + analytics.priorities.medium + analytics.priorities.low
    : categoryTotal;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.85fr)]">
        <ContentCard padding={false} className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-3.5 py-2.5">
            <div>
              <h2 className="text-[15px] font-semibold text-zinc-900">Best opportunities</h2>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                Ranked by link power, relevance, and competitor overlap.
              </p>
            </div>
            <button type="button" onClick={onViewOpportunities} className={dashboardAccentLink}>
              View all opportunities →
            </button>
          </div>
          <div className="p-3.5">
          {topOpportunities.length === 0 ? (
            <p className={dashboardMicro}>No opportunities yet.</p>
          ) : (
            <ol className="divide-y divide-zinc-100">
              {topOpportunities.map((o, i) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(o)}
                    className="flex w-full items-center gap-2 py-2 text-left first:pt-0 last:pb-0 hover:opacity-80"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[10px] font-bold text-zinc-600">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-emerald-700">{o.referring_domain}</p>
                      <p className={`mt-0.5 ${dashboardMicro}`}>
                        Power {o.powerScore ?? "—"}/100 · {o.source_type} ·{" "}
                        {o.linkPassing === "passes" ? "dofollow" : o.linkPassing}
                      </p>
                    </div>
                    {priorityBadge(o.priority)}
                  </button>
                </li>
              ))}
            </ol>
          )}
          </div>
        </ContentCard>

        {(aiSummary || totalOpps > 0 || categoryData.length > 0) && (
          <InsightPanel
            title="Competitive pattern"
            action={
              onViewTasks ? (
                <button type="button" onClick={onViewTasks} className={dashboardAccentLink}>
                  Create tasks →
                </button>
              ) : undefined
            }
          >
            <div className="space-y-2.5">
              {aiSummary ? <p className={dashboardBody}>{aiSummary}</p> : null}
              <p>
                Focus first on domains where multiple competitors are listed and you are absent.
                {categoryData[0]
                  ? ` The strongest pattern is ${categoryData[0].name}, representing ${categoryData[0].count} opportunities.`
                  : ""}
              </p>
              {analytics?.priorities.high ? (
                <p>
                  <strong className="text-zinc-900">{analytics.priorities.high}</strong> high-priority gaps are
                  ready for outreach.
                </p>
              ) : null}
            </div>
          </InsightPanel>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <PanelCard
          title="Opportunity Categories"
          className="[&>div:nth-child(2)]:p-3"
          footer={panelFooterLink("View opportunities tab →", onViewOpportunities)}
        >
          {categoryData.length === 0 ? (
            <p className={dashboardMicro}>No category data.</p>
          ) : (
            <div className="flex items-center gap-2">
              <div className="relative mx-auto h-28 w-28 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      dataKey="count"
                      nameKey="name"
                      innerRadius={42}
                      outerRadius={62}
                      paddingAngle={2}
                    >
                      {categoryData.map((_, idx) => (
                        <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-base font-bold text-zinc-900">{categoryTotal || totalOpps}</p>
                  <p className="text-[10px] text-zinc-500">Total</p>
                </div>
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                {categoryData.map((d, idx) => {
                  const pct = categoryTotal > 0 ? Math.round((d.count / categoryTotal) * 100) : 0;
                  return (
                    <div key={d.name} className="flex items-center gap-2 text-[11px] text-zinc-600">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                      />
                      <span className="truncate">{d.name}</span>
                      <span className="ml-auto font-medium tabular-nums">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </PanelCard>

        <PanelCard
          title="Link Power Distribution"
          className="[&>div:nth-child(2)]:p-3"
          footer={panelFooterLink("See full breakdown →", onViewOpportunities)}
        >
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics?.powerBuckets ?? []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={1} />
                <YAxis tick={{ fontSize: 9 }} width={28} />
                <Tooltip />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {(analytics?.powerBuckets ?? []).map((_, idx) => (
                    <Cell
                      key={idx}
                      fill={idx >= 7 ? "#16A34A" : idx >= 4 ? "#f59e0b" : "#ef4444"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </PanelCard>

        <PanelCard
          title="Link Type Overview"
          className="[&>div:nth-child(2)]:p-3"
          footer={panelFooterLink("Explore opportunities →", onViewOpportunities)}
        >
          {linkTypeData.length === 0 ? (
            <p className={dashboardMicro}>No link type data.</p>
          ) : (
            <div className="flex items-center gap-2">
              <div className="relative mx-auto h-28 w-28 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={linkTypeData} dataKey="value" nameKey="name" innerRadius={42} outerRadius={62}>
                      {linkTypeData.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-base font-bold text-zinc-900">{linkTypeTotal}</p>
                  <p className="text-[10px] text-zinc-500">Total</p>
                </div>
              </div>
              <div className="space-y-1.5">
                {linkTypeData.map((d) => {
                  const pct = linkTypeTotal > 0 ? Math.round((d.value / linkTypeTotal) * 100) : 0;
                  return (
                    <div key={d.name} className="text-[11px] text-zinc-600">
                      <span className="font-medium text-zinc-900">{d.name}</span>{" "}
                      <span>({pct}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </PanelCard>

        <PanelCard
          title="Quick Insights"
          className="[&>div:nth-child(2)]:p-3"
          footer={panelFooterLink("View Tasks →", onViewTasks)}
        >
          <ul className={`space-y-2.5 ${dashboardMicro}`}>
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <span>
                <strong className="text-zinc-900">{analytics?.priorities.high ?? 0}</strong> high-priority gaps
                ready for outreach
              </span>
            </li>
            <li className="flex gap-2">
              <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
              <span>
                <strong className="text-zinc-900">{analytics?.linkTypes.dofollow ?? 0}</strong> dofollow
                opportunities pass link equity
              </span>
            </li>
            <li className="flex gap-2">
              <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-500" />
              <span>
                Top category: <strong className="text-zinc-900">{categoryData[0]?.name ?? "—"}</strong> (
                {categoryData[0]?.count ?? 0} domains)
              </span>
            </li>
          </ul>
        </PanelCard>
      </div>
    </div>
  );
}
