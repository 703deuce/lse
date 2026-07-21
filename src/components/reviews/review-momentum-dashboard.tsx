"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChevronRight,
  Lightbulb,
  MessageSquare,
  Target,
  TrendingUp,
  Flag,
  Loader2,
  Zap,
} from "lucide-react";
import { type MomentumLabel } from "@/lib/reviews/metrics";
import type { MarketInsights } from "@/lib/reviews/market-insights";
import { useModuleJobRunner } from "@/components/jobs/use-module-job-runner";
import { buildMarketInsightsFromEntityRows } from "@/lib/reviews/market-insights";
import {
  ReviewMomentumTopKpis,
} from "@/components/reviews/review-momentum-insights";
import {
  MomentumTableShell,
  momentumTableBadge,
  momentumTableHeadClass,
  formatPace,
  formatChartDate,
} from "@/components/reviews/review-momentum-ui";
import {
  ModulePage,
  AlertBanner,
  ModuleSkeleton,
  ChartCard,
  PageSection,
  MetricStrip,
  ContentCard,
  InsightPanel,
  PageHeader,
  btnPrimary,
  btnGhost,
  iconWellClass,
} from "@/components/ui/design-system";
import { ModuleEmptyState } from "@/components/journey/module-empty-state";
import { cn } from "@/lib/utils";

interface EntityRow {
  id: string;
  entity_type: string;
  name: string;
  rating_current: number | null;
  total_reviews_current: number;
  reviews_7d: number;
  reviews_30d: number;
  reviews_90d: number;
  avg_reviews_per_week: number;
  days_since_last_review: number | null;
  momentum_label: MomentumLabel;
  momentum_score: number;
  gap_to_top3_30d: number | null;
  recommended_weekly_target?: number | null;
  metrics_json: {
    dailyCounts30d?: Array<{ date: string; count: number }>;
    dailyExact7d?: Array<{ date: string; count: number; exact?: boolean }>;
    weeklyBuckets8to30?: Array<{ label: string; count: number; bucketed?: boolean }>;
    trendBuckets90d?: Array<{ label: string; count: number; bucketed?: boolean }>;
    weeklyCounts8w?: Array<{ week: string; count: number }>;
    weekdayHeatmap?: Array<{ day: string; count: number }>;
    unavailable?: boolean;
    velocityAvailable?: boolean;
    velocityWarning?: string | null;
    marketInsights?: MarketInsights;
  };
}

function entityVelocityAvailable(metricsJson?: EntityRow["metrics_json"]): boolean {
  if (metricsJson?.velocityAvailable != null) return metricsJson.velocityAvailable;
  return metricsJson?.unavailable !== true;
}

interface TaskRow {
  id: string;
  title: string;
  description: string;
  priority: string;
  impact: string;
  effort: string;
  status: string;
}

interface RunData {
  campaignAttribution?: {
    confirmed: number;
    likely: number;
    unattributed: number;
  };
  run: {
    id: string;
    status: string;
    ai_summary: string | null;
    warnings: string[];
    created_at: string;
  } | null;
  entities: EntityRow[];
  tasks: TaskRow[];
}

function formatWeeklyPace(value: number): string {
  return formatPace(value);
}

function tableMomentumBadge(label: MomentumLabel): string {
  return momentumTableBadge(label);
}

function StarRating({ rating }: { rating: number | null }) {
  if (rating == null) return <span className="text-zinc-400">—</span>;
  const full = Math.round(rating);
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-500">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < full ? "text-amber-400" : "text-zinc-200"}>
          ★
        </span>
      ))}
      <span className="ml-1 text-xs font-medium text-zinc-800">{rating.toFixed(1)}</span>
    </span>
  );
}

function priorityBadgeClass(priority: string): string {
  const p = priority.toLowerCase();
  if (p.includes("high")) return "bg-red-50 text-red-700 ring-1 ring-red-100";
  if (p.includes("medium")) return "bg-amber-50 text-amber-700 ring-1 ring-amber-100";
  return "bg-violet-50 text-violet-700 ring-1 ring-violet-100";
}

function impactBadgeClass(impact: string): string {
  const i = impact.toLowerCase();
  if (i.includes("high")) return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100";
  if (i.includes("medium")) return "bg-orange-50 text-orange-700 ring-1 ring-orange-100";
  return "bg-sky-50 text-sky-700 ring-1 ring-sky-100";
}

const TASK_ICONS = [MessageSquare, Target, Flag, TrendingUp];

export function ReviewMomentumDashboard({ businessId }: { businessId: string }) {
  const [data, setData] = useState<RunData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reviews/momentum/latest?businessId=${businessId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  const {
    start: startJob,
    running,
    error,
    setError,
  } = useModuleJobRunner({
    onSettled: () => load(),
  });

  async function runAudit() {
    try {
      await startJob(
        "/api/reviews/momentum/run",
        { businessId, competitorLimit: 3, lookbackDays: 90 },
        "Run failed"
      );
    } catch {
      /* error already set by runner */
    }
  }

  async function markTaskDone(taskId: string) {
    await fetch(`/api/reviews/momentum/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done", businessId }),
    });
    await load();
  }

  const target = data?.entities.find((e) => e.entity_type === "target");
  const competitors =
    data?.entities.filter(
      (e) => e.entity_type === "competitor" && entityVelocityAvailable(e.metrics_json)
    ) ?? [];
  const displayEntities = [...(target ? [target] : []), ...competitors];
  const targetVelocityAvailable = target ? entityVelocityAvailable(target.metrics_json) : false;
  const topComp30 = Math.max(...competitors.map((c) => c.reviews_30d), 0);
  const gap = target?.gap_to_top3_30d ?? 0;

  const velocityChart = [
    ...(targetVelocityAvailable
      ? [{ name: "You", reviews: target?.reviews_30d ?? 0, isYou: true }]
      : []),
    ...competitors.slice(0, 5).map((c, i) => ({
      name: c.name.length > 14 ? `${c.name.slice(0, 12)}…` : c.name,
      reviews: c.reviews_30d,
      isYou: false,
      isTopComp: i === 0,
    })),
  ];

  const dailyExact7Raw =
    target?.metrics_json?.dailyExact7d ??
    (target?.metrics_json?.dailyCounts30d ?? []).slice(0, 7).map((d) => ({ ...d, exact: true }));
  const dailyExact7 = dailyExact7Raw.map((d) => ({
    ...d,
    date: formatChartDate(d.date),
  }));
  const trend90 = target?.metrics_json?.trendBuckets90d ?? [];
  const marketFromJson = target?.metrics_json?.marketInsights;
  const market =
    marketFromJson ??
    (data?.entities ? buildMarketInsightsFromEntityRows(data.entities) : null);
  const velocityWarnings =
    target && !entityVelocityAvailable(target.metrics_json) && target.metrics_json?.velocityWarning
      ? [target.metrics_json.velocityWarning as string]
      : [];

  if (loading && !data?.run) {
    return (
      <ModulePage>
        <ModuleSkeleton rows={5} />
      </ModulePage>
    );
  }

  return (
    <ModulePage>
      <PageHeader
        title="Review Momentum"
        description="Understand whether review growth is improving or falling behind."
        meta={
          data?.run?.created_at
            ? `Last analyzed ${new Date(data.run.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}`
            : undefined
        }
        secondaryActions={
          businessId ? (
            <a href={`/businesses/${businessId}/review-requests`} className={btnGhost}>
              Request reviews
            </a>
          ) : null
        }
        primaryAction={
          <button
            type="button"
            onClick={() => void runAudit()}
            disabled={running}
            className={btnPrimary}
          >
            {running ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Zap className="h-3.5 w-3.5 fill-current" />
            )}
            Analyze review momentum
          </button>
        }
      />

      {error && <AlertBanner variant="error">{error}</AlertBanner>}

      {!data?.run ? (
        <ModuleEmptyState
          icon={TrendingUp}
          title="No momentum report yet"
          description="Analyze review momentum after you have a Maps baseline — see whether growth is consistent or a one-time spike."
          actionLabel="Analyze review momentum"
          onAction={() => void runAudit()}
        />
      ) : (
        <>
          {(data.run.warnings as string[])?.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <ul className="list-inside list-disc space-y-1">
                {(data.run.warnings as string[]).map((w, i) => (
                  <li key={`warn-${i}-${w.slice(0, 40)}`}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {velocityWarnings.length > 0 && (
            <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700 shadow-sm">
              <p className="font-semibold text-zinc-900">Your review velocity could not be loaded</p>
              <ul className="mt-2 list-inside list-disc space-y-1">
                {velocityWarnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {data.campaignAttribution &&
            (data.campaignAttribution.confirmed > 0 ||
              data.campaignAttribution.likely > 0 ||
              data.campaignAttribution.unattributed > 0) && (
              <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[12px] text-zinc-700">
                <span className="font-semibold text-zinc-900">Campaign attribution (honest): </span>
                {data.campaignAttribution.confirmed} confirmed · {data.campaignAttribution.likely}{" "}
                likely · {data.campaignAttribution.unattributed} unattributed during campaigns
              </div>
            )}

          {targetVelocityAvailable && target && market && (
            <ReviewMomentumTopKpis
              momentumScore={target.momentum_score}
              momentumLabel={target.momentum_label}
              velocityTrend={market.velocityTrend}
              velocityTrendLabel={market.velocityTrendLabel}
              targetSharePct={market.targetSharePct30d}
              market={market}
            />
          )}

          <MomentumTableShell>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/60">
                    <th className={cn(momentumTableHeadClass(), "px-3.5")}>Business</th>
                    <th className={momentumTableHeadClass()}>Rating</th>
                    <th className={momentumTableHeadClass()}>Total</th>
                    <th className={momentumTableHeadClass()}>7D</th>
                    <th className={momentumTableHeadClass()}>30D</th>
                    <th className={momentumTableHeadClass()}>90D</th>
                    <th className={momentumTableHeadClass()}>Avg / Wk</th>
                    <th className={momentumTableHeadClass()}>Last</th>
                    <th className={momentumTableHeadClass()}>Momentum</th>
                    <th className={cn(momentumTableHeadClass(), "pr-3.5")}>Gap</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {displayEntities.map((e) => {
                    const isTarget = e.entity_type === "target";
                    const velocityAvailable = isTarget
                      ? entityVelocityAvailable(e.metrics_json)
                      : true;
                    return (
                      <tr key={e.id} className="transition-colors hover:bg-zinc-50/50">
                        <td className="px-3.5 py-2">
                          <div className="text-[13px] font-medium text-zinc-900">{e.name}</div>
                          {isTarget && (
                            <div className="mt-0.5 flex flex-wrap gap-1">
                              <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
                                YOU
                              </span>
                              <span
                                className={cn(
                                  "rounded px-1.5 py-0.5 text-[9px] font-semibold",
                                  velocityAvailable
                                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                                    : "bg-zinc-100 text-zinc-500"
                                )}
                              >
                                {velocityAvailable ? "Velocity on" : "Velocity off"}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-3.5 py-2">
                          <StarRating rating={e.rating_current} />
                        </td>
                        <td className="px-3.5 py-2 text-[12px] font-medium tabular-nums text-zinc-900">
                          {e.total_reviews_current}
                        </td>
                        <td className="px-3.5 py-2 text-[12px] tabular-nums text-zinc-600">
                          {velocityAvailable ? e.reviews_7d : "—"}
                        </td>
                        <td
                          className={cn(
                            "px-3.5 py-2 text-[12px] tabular-nums",
                            isTarget && velocityAvailable ? "font-semibold text-emerald-700" : "text-zinc-600"
                          )}
                        >
                          {velocityAvailable ? e.reviews_30d : "—"}
                        </td>
                        <td
                          className={cn(
                            "px-3.5 py-2 text-[12px] tabular-nums",
                            isTarget && velocityAvailable ? "font-semibold text-emerald-700" : "text-zinc-600"
                          )}
                        >
                          {velocityAvailable ? e.reviews_90d : "—"}
                        </td>
                        <td className="px-3.5 py-2 text-[12px] tabular-nums text-zinc-600">
                          {velocityAvailable ? formatWeeklyPace(e.avg_reviews_per_week) : "—"}
                        </td>
                        <td className="px-3.5 py-2 text-[11px] text-zinc-500">
                          {velocityAvailable && e.days_since_last_review != null
                            ? `${e.days_since_last_review}d`
                            : "—"}
                        </td>
                        <td className="px-3.5 py-2">
                          {velocityAvailable ? (
                            <span
                              className={cn(
                                "inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                                tableMomentumBadge(e.momentum_label)
                              )}
                            >
                              {e.momentum_label}
                            </span>
                          ) : (
                            <span className="text-zinc-400">—</span>
                          )}
                        </td>
                        <td className="px-3.5 py-2 text-[12px] font-medium tabular-nums text-zinc-700">
                          {e.entity_type === "target" ? (e.gap_to_top3_30d ?? "—") : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </MomentumTableShell>

          {targetVelocityAvailable && target && (
            <PageSection
              title="Review growth"
              description="Are you gaining reviews faster than competitors?"
            >
              <ChartCard
                tall
                title="Review growth over the last 90 days"
                description="Your pace versus the competitive set — units are new reviews."
              >
                {trend90.filter((d) => (d.count ?? 0) > 0).length < 2 ? (
                  <div className="flex min-h-[180px] flex-col items-start justify-center gap-2 px-1 py-6">
                    <p className="text-sm font-semibold text-[var(--text)]">
                      Not enough review activity to chart yet
                    </p>
                    <p className="max-w-lg text-sm leading-relaxed text-[var(--text-secondary)]">
                      {target.reviews_30d > 0
                        ? `You gained ${target.reviews_30d} review${target.reviews_30d === 1 ? "" : "s"} in the last 30 days. Keep requesting reviews to build a readable trend line.`
                        : "Once new reviews land, this chart will show your pace against the competitive set."}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-6 text-sm">
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                          Current pace
                        </p>
                        <p className="mt-1 text-xl font-bold tabular-nums text-[var(--text)]">
                          {formatPace(target.avg_reviews_per_week)}
                          <span className="ml-1 text-sm font-medium text-[var(--text-muted)]">/week</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                          Market (30d)
                        </p>
                        <p className="mt-1 text-xl font-bold tabular-nums text-[var(--text)]">
                          {market?.marketReviews30d ?? "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={trend90} margin={{ top: 12, right: 12, left: -8, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0f3" />
                      <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#87909E" }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#87909E" }} axisLine={false} tickLine={false} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="count"
                        name="Your reviews"
                        stroke="#137752"
                        strokeWidth={2.5}
                        dot={{ r: 3.5, fill: "#137752" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              <div className="grid gap-4 sm:grid-cols-3">
                <ContentCard>
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                    Current pace
                  </p>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--text)]">
                    {formatPace(target.avg_reviews_per_week)}
                    <span className="ml-1 text-sm font-medium text-[var(--text-muted)]">/week</span>
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">Last 30 days average</p>
                </ContentCard>
                <ContentCard>
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                    Recommended pace
                  </p>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--text)]">
                    {target.recommended_weekly_target != null
                      ? target.recommended_weekly_target
                      : "—"}
                    <span className="ml-1 text-sm font-medium text-[var(--text-muted)]">/week</span>
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    To close the competitive gap
                  </p>
                </ContentCard>
                <ContentCard>
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                    Gap
                  </p>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--text)]">
                    {target.recommended_weekly_target != null
                      ? Math.max(
                          0,
                          Math.round(
                            (Number(target.recommended_weekly_target) -
                              Number(target.avg_reviews_per_week)) *
                              100
                          ) / 100
                        )
                      : gap}
                    <span className="ml-1 text-sm font-medium text-[var(--text-muted)]">
                      {target.recommended_weekly_target != null ? "/week" : " reviews"}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    Vs top competitor 30d: {topComp30}
                  </p>
                </ContentCard>
              </div>

              {market ? (
                <InsightPanel title="What to do next">
                  {target.avg_reviews_per_week < (target.recommended_weekly_target ?? 2) ? (
                    <>
                      At your current pace, competitors can widen the review gap. Aim for{" "}
                      <strong>
                        {target.recommended_weekly_target ?? 2} new reviews each week
                      </strong>
                      . You currently hold {market.targetSharePct30d}% of new reviews in this
                      market ({market.marketActivityLabel.toLowerCase()}).
                    </>
                  ) : (
                    <>
                      You&apos;re keeping pace. Hold {market.targetSharePct30d}% share of new
                      reviews and keep weekly volume near{" "}
                      {formatPace(target.avg_reviews_per_week)}.
                    </>
                  )}
                </InsightPanel>
              ) : null}

              <div className="grid gap-4 lg:grid-cols-2">
                <ChartCard
                  title="30-day velocity vs competitors"
                  description="New reviews in the last 30 days."
                >
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={velocityChart} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0f3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#87909E" }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#87909E" }} axisLine={false} tickLine={false} />
                      <Tooltip />
                      <Bar dataKey="reviews" radius={[4, 4, 0, 0]}>
                        {velocityChart.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={
                              entry.isYou
                                ? "#137752"
                                : "isTopComp" in entry && entry.isTopComp
                                  ? "#52525b"
                                  : "#d4d4d8"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
                <ChartCard title="Last 7 days" description="Daily precision for the current week.">
                  <ResponsiveContainer width="100%" height={180}>
                    <ComposedChart data={dailyExact7} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                      <defs>
                        <linearGradient id="momentum7dFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#137752" stopOpacity={0.22} />
                          <stop offset="100%" stopColor="#137752" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0f3" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#87909E" }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#87909E" }} axisLine={false} tickLine={false} />
                      <Tooltip />
                      <Area type="monotone" dataKey="count" stroke="none" fill="url(#momentum7dFill)" isAnimationActive={false} />
                      <Line type="monotone" dataKey="count" stroke="#137752" strokeWidth={2} dot={{ r: 3, fill: "#137752" }} isAnimationActive={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            </PageSection>
          )}

          {targetVelocityAvailable && target && (
            <MetricStrip
              items={[
                { label: "Last 7 days", value: String(target.reviews_7d) },
                { label: "Last 30 days", value: String(target.reviews_30d) },
                { label: "Last 90 days", value: String(target.reviews_90d) },
                { label: "Top competitor 30d", value: String(topComp30) },
              ]}
            />
          )}

          {(data.run.ai_summary || data.tasks.length > 0) && (
            <PageSection title="Insights & tasks" description="What the data suggests you do next.">
              <div className="grid gap-4 lg:grid-cols-12 lg:items-start">
                {data.run.ai_summary && (
                  <ContentCard className="lg:col-span-4">
                    <div className="flex gap-3">
                      <span className={iconWellClass}>
                        <Lightbulb className="h-4 w-4" />
                      </span>
                      <div>
                        <h3 className="text-sm font-semibold text-zinc-900">What this means</h3>
                        <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">
                          {data.run.ai_summary}
                        </p>
                      </div>
                    </div>
                  </ContentCard>
                )}

                {data.tasks.length > 0 && (
                  <div className={cn("min-w-0 space-y-2", data.run.ai_summary ? "lg:col-span-8" : "lg:col-span-12")}>
                    {data.tasks.map((t, i) => {
                      const Icon = TASK_ICONS[i % TASK_ICONS.length];
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => t.status !== "done" && void markTaskDone(t.id)}
                          className={cn(
                            "flex w-full items-start gap-3 rounded-md border border-zinc-200/90 bg-white px-4 py-3 text-left shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition hover:bg-zinc-50/90",
                            t.status === "done" && "opacity-60"
                          )}
                        >
                          <span className={iconWellClass}>
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p
                              className={cn(
                                "text-sm font-semibold text-zinc-900",
                                t.status === "done" && "line-through"
                              )}
                            >
                              {t.title}
                            </p>
                            <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-zinc-500">
                              {t.description}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-1">
                              <span
                                className={cn(
                                  "rounded px-1.5 py-0.5 text-[10px] font-semibold capitalize",
                                  priorityBadgeClass(t.priority)
                                )}
                              >
                                {t.priority}
                              </span>
                              <span
                                className={cn(
                                  "rounded px-1.5 py-0.5 text-[10px] font-semibold capitalize",
                                  impactBadgeClass(t.impact)
                                )}
                              >
                                {t.impact} impact
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-zinc-300" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </PageSection>
          )}
        </>
      )}
    </ModulePage>
  );
}
