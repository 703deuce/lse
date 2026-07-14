"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import {
  Target,
  MapPin,
  Star,
  Shield,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  Bell,
  FileText,
  Plus,
  MessageSquare,
  ChevronRight,
} from "lucide-react";
import { ScoreProgressBar } from "@/components/overview/overview-charts";
import {
  GaCard,
  GaLink,
  GaSectionTitle,
  ImpactStars,
  MiniScoreCard,
  PriorityTag,
  ScoreGaugeCard,
} from "@/components/growth-audit/growth-audit-ui";
import { cn } from "@/lib/utils";
import type { GrowthAuditSections } from "@/lib/growth-audit/types";

const SNAPSHOT_META: Record<
  string,
  { icon: typeof Target; color: string; description: (score: number) => string }
> = {
  Relevance: {
    icon: Target,
    color: "text-blue-600 bg-blue-50",
    description: (s) =>
      s >= 70 ? "Your content matches local search intent." : "Content relevance needs strengthening.",
  },
  Distance: {
    icon: MapPin,
    color: "text-emerald-600 bg-emerald-50",
    description: (s) =>
      s >= 70 ? "Strong proximity signals in your market." : "Distance signals are limiting visibility.",
  },
  Prominence: {
    icon: Star,
    color: "text-orange-600 bg-orange-50",
    description: (s) =>
      s >= 70 ? "Prominence signals are competitive." : "Prominence needs more engagement drivers.",
  },
  Trust: {
    icon: Shield,
    color: "text-emerald-600 bg-emerald-50",
    description: (s) =>
      s >= 70 ? "Strong trust foundation across channels." : "Trust signals need attention.",
  },
  Consistency: {
    icon: CheckCircle2,
    color: "text-violet-600 bg-violet-50",
    description: (s) =>
      s >= 70 ? "NAP and brand consistency is solid." : "Inconsistencies may hurt local rankings.",
  },
};

const TASK_ICONS = [Bell, FileText, Plus, MessageSquare];

function deriveConsistencyScore(sections: GrowthAuditSections): number {
  const checks = [...sections.website.checks, ...sections.gbp.checks];
  if (!checks.length) return 50;
  const matched = checks.filter((c) => c.status === "match").length;
  return Math.round((matched / checks.length) * 100);
}

export function GrowthAuditOverviewTab({
  businessId,
  sections,
  growthScore,
  onGoToActionPlan,
}: {
  businessId: string;
  sections: GrowthAuditSections;
  growthScore: number;
  onGoToActionPlan: () => void;
}) {
  const [chartData, setChartData] = useState<Array<{ label: string; you: number; competitors: number }>>([]);

  useEffect(() => {
    void fetch(`/api/reviews/momentum/latest?businessId=${businessId}`)
      .then((r) => r.json())
      .then((data) => {
        const metrics = data.run?.metrics_json as Record<string, unknown> | undefined;
        const weekly =
          (metrics?.weeklyBuckets8to30 as Array<{ label: string; count: number }>) ?? [];
        const marketWeekly = Math.round(
          ((metrics?.marketReviews30d as number) ?? 0) / Math.max(weekly.length, 1)
        );
        if (weekly.length) {
          setChartData(
            weekly.slice(-8).map((w) => ({
              label: w.label,
              you: w.count,
              competitors: marketWeekly || w.count + 2,
            }))
          );
        }
      })
      .catch(() => {});
  }, [businessId]);

  const scanScores = sections.overview.scanScores;
  const snapshotItems = [
    { label: "Relevance", value: scanScores?.relevance ?? sections.website.score },
    { label: "Distance", value: scanScores?.distance ?? sections.localCoverage.score },
    { label: "Prominence", value: scanScores?.prominence ?? sections.gbp.score },
    { label: "Trust", value: scanScores?.trust ?? sections.website.score },
    { label: "Consistency", value: deriveConsistencyScore(sections) },
  ];

  const actionPlanScore = Math.min(
    100,
    Math.round((sections.growthPlan.tasks.filter((t) => t.priority === "high").length / Math.max(sections.growthPlan.tasks.length, 1)) * 100 + 40)
  );

  const topTasks = sections.growthPlan.tasks.slice(0, 4);

  return (
    <div className="space-y-4">
      <div className="grid gap-2 xl:grid-cols-[minmax(220px,1.25fr)_repeat(5,minmax(0,1fr))]">
        <ScoreGaugeCard title="Overall Audit Score" score={growthScore} />
        <MiniScoreCard title="GBP Score" score={sections.gbp.score} />
        <MiniScoreCard title="Website Match" score={sections.website.score} />
        <MiniScoreCard title="Coverage" score={Math.round((sections.serviceCoverage.score + sections.localCoverage.score) / 2)} />
        <MiniScoreCard title="Competitive Position" score={sections.competitorGap.score} />
        <MiniScoreCard title="Action Plan Readiness" score={actionPlanScore} />
      </div>

      <GaCard>
        <GaSectionTitle
          title="Review Momentum"
          subtitle="Compare your review velocity against top local competitors."
        />
        <div className="grid gap-3 lg:grid-cols-[1fr_1.5fr_1fr] lg:items-center">
          <p className="text-[13px] leading-relaxed text-zinc-600">
            {sections.gbp.reviews.reviewCount > 0
              ? `You have ${sections.gbp.reviews.reviewCount} reviews at ${sections.gbp.reviews.rating ?? "—"}★. Steady review growth helps close the gap with top competitors.`
              : "Review velocity is a key local ranking signal. Start building momentum to compete."}
          </p>
          <div className="h-36">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
                  <Area type="monotone" dataKey="competitors" stroke="#d4d4d8" strokeDasharray="4 4" fill="none" strokeWidth={2} />
                  <Area type="monotone" dataKey="you" stroke="#059669" fill="#059669" fillOpacity={0.08} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-[13px] text-zinc-400">
                Run Review Momentum for trend data
              </div>
            )}
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <div className="flex items-start gap-2">
              <Target className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <div>
                <p className="text-[13px] font-medium text-zinc-900">Focus on increasing review velocity</p>
                <p className="mt-1 text-[11px] text-zinc-500">Consistent reviews improve trust and prominence.</p>
                <Link
                  href={`/businesses/${businessId}/review-momentum`}
                  className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700"
                >
                  View Review Insights
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </GaCard>

      <section>
        <div className="mb-2.5">
          <h2 className="text-[13px] font-semibold tracking-tight text-zinc-900">Audit Snapshot</h2>
          <p className="mt-0.5 text-[11px] text-zinc-500">Key factors that influence your Google Maps visibility.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {snapshotItems.map((item) => {
            const meta = SNAPSHOT_META[item.label];
            const Icon = meta.icon;
            return (
              <GaCard key={item.label} className="!p-3.5">
                <div className="flex items-center gap-2">
                  <span className={cn("flex h-7 w-7 items-center justify-center rounded-md", meta.color)}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{item.label}</p>
                </div>
                <span
                  className={cn(
                    "mt-1.5 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                    item.value >= 70 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                  )}
                >
                  {item.value >= 70 ? "Strong" : "Needs Work"}
                </span>
                <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-zinc-500">{meta.description(item.value)}</p>
                <p className="mt-1.5 text-[13px] font-bold tabular-nums text-zinc-900">{item.value}/100</p>
                <div className="mt-1.5">
                  <ScoreProgressBar score={item.value} />
                </div>
              </GaCard>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-2.5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Top Opportunities</h2>
            <p className="mt-0.5 text-[11px] text-zinc-500">High-impact actions to improve your Maps visibility.</p>
          </div>
          <GaLink onClick={onGoToActionPlan}>View Full Action Plan</GaLink>
        </div>
        <GaCard className="!p-0 overflow-hidden">
          <div className="divide-y divide-zinc-100">
            {topTasks.map((task, i) => {
              const Icon = TASK_ICONS[i % TASK_ICONS.length];
              return (
                <button
                  key={`${task.title}-${i}`}
                  type="button"
                  onClick={onGoToActionPlan}
                  className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition hover:bg-zinc-50"
                >
                  <PriorityTag priority={task.priority} />
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-50 text-zinc-500">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-zinc-900">{task.title}</p>
                    <p className="mt-0.5 truncate text-[11px] text-zinc-500">{task.description}</p>
                  </div>
                  <div className="hidden shrink-0 items-center gap-3 sm:flex">
                    <div className="text-center">
                      <p className="text-[10px] font-medium uppercase text-zinc-400">Impact</p>
                      <ImpactStars count={task.impactStars} />
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-medium uppercase text-zinc-400">Difficulty</p>
                      <p className={cn("text-[11px] font-medium capitalize", task.difficulty === "easy" ? "text-emerald-600" : "text-amber-600")}>
                        {task.difficulty}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-medium uppercase text-zinc-400">Est. Time</p>
                      <p className="text-[11px] font-medium text-zinc-700">{task.timeEstimate}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />
                </button>
              );
            })}
          </div>
          {sections.growthPlan.tasks.length > 4 && (
            <div className="border-t border-zinc-100 px-3.5 py-2.5 text-center">
              <button
                type="button"
                onClick={onGoToActionPlan}
                className="text-[12px] font-medium text-zinc-600 hover:text-zinc-900"
              >
                View All Opportunities ({sections.growthPlan.tasks.length})
              </button>
            </div>
          )}
        </GaCard>
      </section>

      {sections.overview.strengths.length > 0 && (
        <section>
          <h2 className="mb-2.5 text-base font-semibold text-zinc-900">Insights</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {sections.overview.strengths.slice(0, 1).map((s) => (
              <GaCard key={s} className="!p-3.5">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  <div>
                    <p className="text-[13px] font-semibold text-zinc-900">Core information is consistent</p>
                    <p className="mt-1 text-[11px] text-zinc-500">{s}</p>
                  </div>
                </div>
              </GaCard>
            ))}
            {sections.overview.weaknesses.slice(0, 1).map((s) => (
              <GaCard key={s} className="!p-3.5">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                  <div>
                    <p className="text-[13px] font-semibold text-zinc-900">Engagement needs attention</p>
                    <p className="mt-1 text-[11px] text-zinc-500">{s}</p>
                  </div>
                </div>
              </GaCard>
            ))}
            <GaCard className="!p-3.5">
              <div className="flex items-start gap-3">
                <BarChart3 className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                <div>
                  <p className="text-[13px] font-semibold text-zinc-900">Review momentum</p>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    {sections.gbp.reviews.reviewCount >= 20
                      ? "You're building review volume. Keep up consistent requests."
                      : "Growing reviews consistently will improve trust and rankings."}
                  </p>
                </div>
              </div>
            </GaCard>
          </div>
        </section>
      )}
    </div>
  );
}
