"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  FileText,
  Globe,
  Grid3x3,
  Heart,
  PieChart as PieChartIcon,
  Sparkles,
  Target,
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import {
  MOCKUP_GROUP_LABELS,
  OPPORTUNITY_DISPLAY_GROUP_LABELS,
  type OpportunityDisplayGroup,
} from "@/lib/local-trust/types";
import { TrustPanelCard } from "@/components/local-trust/local-trust-ui";

type TypeCount = { type: string; count: number };

const PRIORITY_COLORS = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#3b82f6",
  easy: "#10b981",
};

const CATEGORY_ICONS: Record<string, typeof Building2> = {
  local_sponsorship: Heart,
  civic_membership: Building2,
  cleanup_environmental: Globe,
  vendor_registration: FileText,
};

function categoryLabel(type: string) {
  return (
    MOCKUP_GROUP_LABELS[type as OpportunityDisplayGroup] ??
    OPPORTUNITY_DISPLAY_GROUP_LABELS[type as OpportunityDisplayGroup] ??
    type.replace(/_/g, " ")
  );
}

export function LocalTrustOverviewTab({
  businessId,
  aiSummary,
  quickWins,
  opportunitiesFound,
  easyWins,
  onViewOpportunities,
  marketQuery = "",
}: {
  businessId: string;
  aiSummary: string | null;
  quickWins: string[];
  opportunitiesFound: number;
  easyWins: number;
  onViewOpportunities: () => void;
  marketQuery?: string;
}) {
  const [counts, setCounts] = useState<TypeCount[]>([]);
  const [priorities, setPriorities] = useState({ high: 0, medium: 0, low: 0, easy: 0 });

  useEffect(() => {
    void (async () => {
      const suffix = marketQuery ? `?${marketQuery}` : "";
      const oppsSuffix = marketQuery ? (marketQuery.includes("?") ? `&${marketQuery.replace(/^\?/, "")}` : `&${marketQuery}`) : "";
      const [countsRes, oppsRes] = await Promise.all([
        fetch(`/api/trust/${businessId}/counts${suffix}`),
        fetch(`/api/trust/${businessId}/opportunities?pageSize=100${oppsSuffix}`),
      ]);
      const countsJson = await countsRes.json();
      const oppsJson = await oppsRes.json();
      if (countsRes.ok) setCounts(countsJson.counts ?? []);
      if (oppsRes.ok) {
        const items = (oppsJson.items ?? []) as Array<{ priority: string; difficulty: string }>;
        const p = { high: 0, medium: 0, low: 0, easy: 0 };
        for (const item of items) {
          if (item.priority === "high") p.high++;
          else if (item.priority === "medium") p.medium++;
          else if (item.priority === "low") p.low++;
          if (item.difficulty === "easy") p.easy++;
        }
        setPriorities(p);
      }
    })();
  }, [businessId, marketQuery]);

  const total = opportunitiesFound || counts.reduce((s, c) => s + c.count, 0);
  const pieData = [
    { name: "High", value: priorities.high, color: PRIORITY_COLORS.high },
    { name: "Medium", value: priorities.medium, color: PRIORITY_COLORS.medium },
    { name: "Low", value: priorities.low, color: PRIORITY_COLORS.low },
    { name: "Easy Wins", value: priorities.easy || easyWins, color: PRIORITY_COLORS.easy },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-3">
      {aiSummary && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3.5 py-3">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <div>
              <p className="text-[13px] font-semibold text-emerald-800">AI Summary</p>
              <p className="mt-0.5 text-[13px] leading-snug text-zinc-700">{aiSummary}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onViewOpportunities}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-zinc-800 shadow-sm hover:bg-zinc-50"
          >
            View all opportunities
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-3">
        <TrustPanelCard
          title="Quick Wins"
          subtitle="Low effort actions with high local impact"
          action={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
        >
          {quickWins.length === 0 ? (
            <p className="text-[13px] text-zinc-500">Run the finder to generate quick wins.</p>
          ) : (
            <ul className="space-y-2">
              {quickWins.slice(0, 6).map((w) => (
                <li key={w} className="flex items-start gap-2 text-[13px] text-zinc-700">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full border-2 border-emerald-500 bg-white" />
                  <span className="leading-snug">{w}</span>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={onViewOpportunities}
            className="mt-3 text-[12px] font-medium text-emerald-700 hover:underline"
          >
            View all easy wins →
          </button>
        </TrustPanelCard>

        <TrustPanelCard
          title="Top Opportunity Categories"
          subtitle="Where your best local trust wins are"
          action={<Grid3x3 className="h-4 w-4 text-emerald-600" />}
        >
          {counts.length === 0 ? (
            <p className="text-[13px] text-zinc-500">No categories yet.</p>
          ) : (
            <ul className="space-y-3">
              {counts.slice(0, 4).map((c) => {
                const pct = total > 0 ? Math.round((c.count / total) * 100) : 0;
                const label = categoryLabel(c.type);
                const Icon = CATEGORY_ICONS[c.type] ?? Building2;
                return (
                  <li key={c.type} className="flex items-start gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between text-[13px]">
                        <span className="font-medium text-zinc-800">{label}</span>
                        <span className="text-[11px] text-zinc-500">
                          {c.count} · {pct}%
                        </span>
                      </div>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-zinc-100">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <button
            type="button"
            onClick={onViewOpportunities}
            className="mt-3 text-[12px] font-medium text-emerald-700 hover:underline"
          >
            View all categories →
          </button>
        </TrustPanelCard>

        <TrustPanelCard
          title="Priority Breakdown"
          subtitle="Focus your outreach efforts"
          action={<PieChartIcon className="h-3.5 w-3.5 text-emerald-600" />}
        >
          <div className="flex items-center gap-3">
            <div className="relative h-28 w-28 shrink-0">
              {pieData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" innerRadius={42} outerRadius={58} paddingAngle={2}>
                        {pieData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-base font-bold text-zinc-900">{total}</span>
                    <span className="text-[10px] text-zinc-500">Total</span>
                  </div>
                </>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-zinc-400">No data</div>
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              {pieData.map((d) => (
                <div key={d.name} className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-2 text-zinc-600">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} />
                    {d.name}
                  </span>
                  <span className="font-semibold tabular-nums text-zinc-800">
                    {d.value}
                    {total > 0 ? ` (${Math.round((d.value / total) * 100)}%)` : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 rounded-md bg-emerald-50 px-2.5 py-2 text-[11px] leading-snug text-emerald-800">
            <Target className="mb-0.5 inline h-3 w-3" /> Focus on Medium Priority opportunities for the biggest
            impact.
          </div>
        </TrustPanelCard>
      </div>
    </div>
  );
}
