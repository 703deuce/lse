"use client";

import { useMemo, useState } from "react";
import {
  BarChart3,
  Download,
  Eye,
  Flag,
  MapPinned,
  MessageSquareText,
  RefreshCw,
  Star,
  Target,
  TrendingUp,
} from "lucide-react";
import { RepBadge, RepMetricCard, RepPageHeader, RepTabs, rep } from "@/components/reputation/rep-ui";
import type { ReputationModulesAuditData } from "@/lib/reputation/reputation-modules-audit";
import { cn } from "@/lib/utils";

type AuditTab =
  | "summary"
  | "position"
  | "velocity"
  | "gap"
  | "strengths"
  | "response"
  | "opportunities"
  | "action";

const TABS: Array<{ id: AuditTab; label: string }> = [
  { id: "summary", label: "Executive Summary" },
  { id: "position", label: "Review Position" },
  { id: "velocity", label: "Velocity & Momentum" },
  { id: "gap", label: "Competitor Gap" },
  { id: "strengths", label: "Strengths & Gaps" },
  { id: "response", label: "Response Performance" },
  { id: "opportunities", label: "Opportunities" },
  { id: "action", label: "Action Plan" },
];

function fmt(value: number | null | undefined, digits = 0) {
  if (value == null || Number.isNaN(value)) return "—";
  return digits > 0 ? value.toFixed(digits) : value.toLocaleString();
}

function MiniBarChart({ values }: { values: Array<{ label: string; value: number; color?: string }> }) {
  const max = Math.max(...values.map((item) => item.value), 1);
  return (
    <div className="space-y-3">
      {values.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-[#667085]">{item.label}</span>
            <span className="font-semibold text-[#101828]">{item.value}</span>
          </div>
          <div className="h-2 rounded-full bg-[#F2F4F7]">
            <div
              className="h-2 rounded-full"
              style={{ width: `${Math.max(8, (item.value / max) * 100)}%`, backgroundColor: item.color ?? "#137752" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function Donut({ pct }: { pct: number }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.max(0, Math.min(100, pct)) / 100) * circumference;
  return (
    <div className="relative mx-auto h-28 w-28">
      <svg viewBox="0 0 100 100" className="-rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#E6EAF0" strokeWidth="10" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="#137752"
          strokeLinecap="round"
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold text-[#101828]">{pct}%</span>
      </div>
    </div>
  );
}

function SectionCard({
  id,
  title,
  icon: Icon,
  children,
  className,
}: {
  id: string;
  title: string;
  icon: typeof Target;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn(rep.card, "p-4", className)}>
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ECFDF3] text-[#137752]">
          <Icon className="h-4 w-4" />
        </span>
        <h2 className="text-sm font-semibold text-[#101828]">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export function ReputationStrategyReport({
  businessId: _businessId,
  data,
}: {
  businessId: string;
  data: ReputationModulesAuditData;
}) {
  const [activeTab, setActiveTab] = useState<AuditTab>("summary");
  const you = data.competitors.leaderboardRows.find((row) => row.isYou);
  const topCompetitor = data.competitors.leaderboardRows.find((row) => !row.isYou);
  const topGap = data.competitors.gapRows.find((row) => row.totalGap > 0);
  const overallScore = useMemo(() => {
    if (data.businessId.includes("preview")) return 82;
    const ratingScore = ((you?.rating ?? 4.2) / 5) * 35;
    const responseScore = (data.insights.responsePerformance.responseRate / 100) * 25;
    const velocityScore = Math.min(25, (data.analytics.rolling30d / 35) * 25);
    const alertScore = Math.max(0, 15 - data.alerts.activeAlerts.length * 3);
    return Math.round(ratingScore + responseScore + velocityScore + alertScore);
  }, [data.alerts.activeAlerts.length, data.analytics.rolling30d, data.businessId, data.insights.responsePerformance.responseRate, you?.rating]);

  const summary =
    `${data.businessName} has a ${fmt(you?.rating, 1)} Google rating across ${fmt(you?.totalReviews)} reviews with ` +
    `${data.analytics.rolling30d} new reviews in the last 30 days. Momentum is ${data.analytics.momentumStatus.toLowerCase()} and ` +
    `${data.insights.responsePerformance.responseRate}% of text reviews have owner responses.`;

  function handleTab(id: string) {
    const next = id as AuditTab;
    setActiveTab(next);
    const targetId =
      next === "summary"
        ? "executive-summary"
        : next === "position"
          ? "review-position"
          : next === "velocity"
            ? "velocity-momentum"
            : next === "gap"
              ? "competitor-gap"
              : next === "strengths"
                ? "review-insights"
                : next === "response"
                  ? "response-performance"
                  : next === "opportunities"
                    ? "opportunities"
                    : "action-plan";
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className={rep.page} data-business-id={_businessId}>
      <RepPageHeader
        title="Reputation Audit"
        subtitle="Comprehensive review, competitor, response, and visibility strategy report."
        dateRangeLabel="Last 90 Days"
        showCompare={false}
        showExport={false}
        showFilters={false}
        actions={
          <>
            <button type="button" className={rep.btnSecondary}>
              <RefreshCw className="h-4 w-4" />
              Regenerate Audit
            </button>
            <button type="button" className={rep.btnPrimary}>
              <Download className="h-4 w-4" />
              Export Report
            </button>
          </>
        }
      />

      <RepTabs tabs={TABS} active={activeTab} onChange={handleTab} />

      <section id="executive-summary" className={cn(rep.card, "p-5")}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <RepBadge>Executive Summary</RepBadge>
            <h2 className="mt-3 text-xl font-bold text-[#101828]">Reputation score: {overallScore}/100</h2>
            <p className="mt-2 text-sm leading-6 text-[#344054]">{summary}</p>
          </div>
          <div className="rounded-2xl bg-[#ECFDF3] p-4 text-center">
            <p className={rep.label}>Overall Reputation Score</p>
            <p className="mt-2 text-5xl font-bold text-[#137752]">{overallScore}</p>
            <p className="mt-1 text-xs text-[#667085]">Target: 90+</p>
          </div>
        </div>
      </section>

      <div id="review-position" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <RepMetricCard label="Google Rating" value={fmt(you?.rating, 1)} icon={Star} hint={topCompetitor?.rating ? `vs ${fmt(topCompetitor.rating, 1)} top competitor` : "Current rating"} />
        <RepMetricCard label="Reviews Total" value={fmt(you?.totalReviews)} icon={MessageSquareText} hint={topGap ? `${topGap.totalGap} behind ${topGap.competitorName}` : "Competitive position"} />
        <RepMetricCard label="Reviews 30d" value={data.analytics.rolling30d} icon={TrendingUp} trend={`+${data.analytics.priorPeriod.rolling30dDelta}`} hint="vs prior period" />
        <RepMetricCard label="Momentum" value={data.analytics.momentumStatus} icon={BarChart3} hint={data.analytics.drivers[0] ?? "Velocity trend"} valueClassName="text-[22px]" />
        <RepMetricCard label="Review Position" value={topGap ? "#2" : "#1"} icon={Flag} hint={topGap ? `Catch-up: ${topGap.estimatedCatchUp}` : "Leading tracked competitors"} />
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <SectionCard id="velocity-momentum" title="Velocity & Momentum" icon={TrendingUp} className="xl:col-span-1">
          <MiniBarChart
            values={[
              { label: "7d", value: data.analytics.rolling7d },
              { label: "30d", value: data.analytics.rolling30d },
              { label: "60d", value: data.analytics.rolling60d },
              { label: "90d", value: data.analytics.rolling90d },
            ]}
          />
          <p className="mt-4 text-sm leading-6 text-[#667085]">{data.analytics.explanation}</p>
        </SectionCard>

        <SectionCard id="competitor-gap" title="Competitor Gap" icon={Target}>
          {data.competitors.gapRows.slice(0, 3).map((row) => (
            <div key={row.competitorId} className="mb-3 rounded-xl bg-[#F9FAFB] p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[#101828]">{row.competitorName}</p>
                <RepBadge tone={row.gapExpanding ? "red" : "green"}>{row.totalGap} gap</RepBadge>
              </div>
              <p className="mt-1 text-xs text-[#667085]">{row.estimatedCatchUp}</p>
            </div>
          ))}
        </SectionCard>

        <SectionCard id="review-insights" title="Review Insights Themes" icon={MessageSquareText}>
          <div className="space-y-2">
            {data.insights.themes.positive.slice(0, 4).map((theme) => (
              <div key={theme.label} className="flex items-center justify-between rounded-lg bg-[#F9FAFB] px-3 py-2">
                <span className="text-sm text-[#344054]">{theme.label}</span>
                <span className="text-sm font-semibold text-[#101828]">{theme.count}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <SectionCard id="response-performance" title="Response Performance" icon={MessageSquareText}>
          <Donut pct={data.insights.responsePerformance.responseRate} />
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg bg-[#F9FAFB] p-3">
              <p className={rep.label}>Answered</p>
              <p className="mt-1 font-bold text-[#101828]">{data.insights.responsePerformance.answered}</p>
            </div>
            <div className="rounded-lg bg-[#F9FAFB] p-3">
              <p className={rep.label}>Unanswered negative</p>
              <p className="mt-1 font-bold text-[#B42318]">{data.insights.responsePerformance.unansweredNegative}</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard id="maps-impact" title="Maps Visibility Impact" icon={MapPinned}>
          <p className="text-sm leading-6 text-[#344054]">{data.mapsVisibility.summary}</p>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-[#667085]">Scans 30d</dt><dd className="font-semibold text-[#101828]">{data.mapsVisibility.scanCount30d}</dd></div>
            <div className="flex justify-between"><dt className="text-[#667085]">Grid size</dt><dd className="font-semibold text-[#101828]">{data.mapsVisibility.gridSize ?? "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-[#667085]">Status</dt><dd className="font-semibold capitalize text-[#101828]">{data.mapsVisibility.latestStatus ?? "—"}</dd></div>
          </dl>
        </SectionCard>

        <SectionCard id="opportunities" title="Recommended Next Actions" icon={Flag}>
          <div className="space-y-2">
            {data.recommendedActions.days30.slice(0, 3).map((action) => (
              <div key={action} className="rounded-lg bg-[#F9FAFB] p-3 text-sm leading-5 text-[#344054]">
                {action}
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div id="action-plan" className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_280px]">
        <SectionCard id="action-plan-preview" title="30/60/90 Day Action Plan Preview" icon={Target}>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { title: "30 Days", items: data.recommendedActions.days30 },
              { title: "60 Days", items: data.recommendedActions.days60 },
              { title: "90 Days", items: data.recommendedActions.days90 },
            ].map((period) => (
              <div key={period.title} className="rounded-xl bg-[#F9FAFB] p-3">
                <h3 className="text-sm font-semibold text-[#101828]">{period.title}</h3>
                <ul className="mt-2 space-y-2 text-sm leading-5 text-[#667085]">
                  {period.items.slice(0, 3).map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </SectionCard>
        <div className={cn(rep.card, "flex flex-col justify-between p-5")}>
          <div>
            <Eye className="h-6 w-6 text-[#137752]" />
            <p className="mt-4 text-sm font-semibold text-[#101828]">Overall Reputation Score</p>
            <p className="mt-2 text-6xl font-bold text-[#137752]">{overallScore}</p>
          </div>
          <p className="mt-4 text-sm text-[#667085]">
            Improve by clearing high-severity alerts and sustaining review velocity above local competitors.
          </p>
        </div>
      </div>
    </div>
  );
}
