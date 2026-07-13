"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
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
  Calendar,
  ChevronRight,
  Flag,
  Lightbulb,
  Loader2,
  MessageSquare,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { type MomentumLabel } from "@/lib/reviews/metrics";
import type { MarketInsights } from "@/lib/reviews/market-insights";
import { buildMarketInsightsFromEntityRows } from "@/lib/reviews/market-insights";
import {
  MomentumScoreBarsPanel,
  MomentumSnapshotCard,
  ReviewMomentumTopKpis,
  ShareOfReviewsPanel,
  WeeklyPacePanel,
} from "@/components/reviews/review-momentum-insights";
import {
  MomentumPageHeader,
  MomentumTopBar,
  MomentumTableShell,
  momentumTableBadge,
  momentumTableHeadClass,
  formatPace,
  formatChartDate,
  momentumCardClass,
} from "@/components/reviews/review-momentum-ui";
import { ModulePage, AlertBanner, btnSecondary } from "@/components/ui/design-system";
import { KpiRow } from "@/components/ui/metric-card";
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
const TASK_ICON_COLORS = [
  "bg-emerald-50 text-emerald-600",
  "bg-orange-50 text-orange-600",
  "bg-sky-50 text-sky-600",
  "bg-violet-50 text-violet-600",
];

export function ReviewMomentumDashboard({ businessId }: { businessId: string }) {
  const [data, setData] = useState<RunData | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
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

  async function runAudit() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/reviews/momentum/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, competitorLimit: 3, lookbackDays: 90 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Run failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run failed");
    } finally {
      setRunning(false);
    }
  }

  async function markTaskDone(taskId: string) {
    await fetch(`/api/reviews/momentum/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done" }),
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
  const weeklyBuckets30 = (
    target?.metrics_json?.weeklyBuckets8to30 ??
    (target?.metrics_json?.dailyCounts30d ?? []).slice(7).map((d, i) => ({
      label: `Week ${i + 1}`,
      count: d.count,
      bucketed: true,
    }))
  ).map((b, i) => ({
    ...b,
    label: b.label.replace(/^Week \d+.*/, `Week ${i + 1}`),
  }));
  const trend90 = target?.metrics_json?.trendBuckets90d ?? [];
  const marketFromJson = target?.metrics_json?.marketInsights;
  const market =
    marketFromJson ??
    (data?.entities ? buildMarketInsightsFromEntityRows(data.entities) : null);
  const heatmap = target?.metrics_json?.weekdayHeatmap ?? [];
  const velocityWarnings =
    target && !entityVelocityAvailable(target.metrics_json) && target.metrics_json?.velocityWarning
      ? [target.metrics_json.velocityWarning as string]
      : [];

  if (loading && !data?.run) {
    return (
      <div className="flex items-center gap-2 py-8 text-[13px] text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading Review Momentum…
      </div>
    );
  }

  return (
    <ModulePage>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <MomentumPageHeader />
        <MomentumTopBar running={running} onRun={() => void runAudit()} />
      </div>

      {error && <AlertBanner variant="error">{error}</AlertBanner>}

      {!data?.run ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-3.5 py-8 text-center text-[13px]">
          <TrendingUp className="mx-auto h-10 w-10 text-zinc-400" />
          <p className="mt-4 font-medium text-zinc-900">No momentum report yet.</p>
          <p className="mt-1 text-[13px] text-zinc-500">
            Run a grid scan first, then click Run Momentum Audit.
          </p>
        </div>
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

          {targetVelocityAvailable && target && market && (
            <>
              <ReviewMomentumTopKpis
                momentumScore={target.momentum_score}
                momentumLabel={target.momentum_label}
                velocityTrend={market.velocityTrend}
                velocityTrendLabel={market.velocityTrendLabel}
                targetSharePct={market.targetSharePct30d}
                market={market}
              />

              <KpiRow cols={6}>
                <MomentumSnapshotCard
                  icon={Calendar}
                  label="Last 7 Days (Exact)"
                  value={String(target.reviews_7d)}
                  sub="daily precision"
                />
                <MomentumSnapshotCard
                  icon={Calendar}
                  label="Last 30 Days"
                  value={String(target.reviews_30d)}
                  sub="primary momentum score"
                />
                <MomentumSnapshotCard
                  icon={Calendar}
                  label="Last 90 Days"
                  value={String(target.reviews_90d)}
                  sub="trend context"
                />
                <MomentumSnapshotCard
                  icon={Trophy}
                  label="Top Competitor 30D"
                  value={String(topComp30)}
                  sub="highest 30-day total"
                />
                <MomentumSnapshotCard
                  icon={Target}
                  label="Review Gap"
                  value={String(gap)}
                  sub="vs top 3 avg - 30D"
                />
                <MomentumSnapshotCard
                  icon={Flag}
                  label="Recommended Target"
                  value={
                    target.recommended_weekly_target != null
                      ? `${target.recommended_weekly_target} / week`
                      : "—"
                  }
                  sub="reviews per week"
                />
              </KpiRow>

              <div className="grid gap-2 xl:grid-cols-3">
                <WeeklyPacePanel market={market} />
                <ShareOfReviewsPanel market={market} />
                <MomentumScoreBarsPanel entities={displayEntities} />
              </div>
            </>
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
                        <td className="px-2.5 py-2">
                          <StarRating rating={e.rating_current} />
                        </td>
                        <td className="px-2.5 py-2 text-[12px] font-medium tabular-nums text-zinc-900">
                          {e.total_reviews_current}
                        </td>
                        <td className="px-2.5 py-2 text-[12px] tabular-nums text-zinc-600">
                          {velocityAvailable ? e.reviews_7d : "—"}
                        </td>
                        <td
                          className={cn(
                            "px-2.5 py-2 text-[12px] tabular-nums",
                            isTarget && velocityAvailable ? "font-semibold text-emerald-700" : "text-zinc-600"
                          )}
                        >
                          {velocityAvailable ? e.reviews_30d : "—"}
                        </td>
                        <td
                          className={cn(
                            "px-2.5 py-2 text-[12px] tabular-nums",
                            isTarget && velocityAvailable ? "font-semibold text-emerald-700" : "text-zinc-600"
                          )}
                        >
                          {velocityAvailable ? e.reviews_90d : "—"}
                        </td>
                        <td className="px-2.5 py-2 text-[12px] tabular-nums text-zinc-600">
                          {velocityAvailable ? formatWeeklyPace(e.avg_reviews_per_week) : "—"}
                        </td>
                        <td className="px-2.5 py-2 text-[11px] text-zinc-500">
                          {velocityAvailable && e.days_since_last_review != null
                            ? `${e.days_since_last_review}d`
                            : "—"}
                        </td>
                        <td className="px-2.5 py-2">
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

          {targetVelocityAvailable && (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              <MiniChartCard title="30-Day Velocity">
                <ResponsiveContainer width="100%" height={108}>
                  <BarChart data={velocityChart} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="reviews" radius={[3, 3, 0, 0]}>
                      {velocityChart.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={
                            entry.isYou
                              ? "#16A34A"
                              : "isTopComp" in entry && entry.isTopComp
                                ? "#52525b"
                                : "#d4d4d8"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </MiniChartCard>

              <MiniChartCard title="Last 7 Days">
                <ResponsiveContainer width="100%" height={108}>
                  <ComposedChart data={dailyExact7} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="momentum7dFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#16A34A" stopOpacity={0.22} />
                        <stop offset="100%" stopColor="#16A34A" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                    <XAxis dataKey="date" tick={{ fontSize: 8 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="none"
                      fill="url(#momentum7dFill)"
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#16A34A"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "#16A34A" }}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </MiniChartCard>

              <MiniChartCard title="Days 8–30">
                <ResponsiveContainer width="100%" height={108}>
                  <BarChart
                    data={weeklyBuckets30}
                    margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                    <XAxis dataKey="label" tick={{ fontSize: 8 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#16A34A" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </MiniChartCard>

              <MiniChartCard title="90-Day Trend">
                <ResponsiveContainer width="100%" height={108}>
                  <LineChart data={trend90} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                    <XAxis dataKey="label" tick={{ fontSize: 8 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#f97316"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "#f97316" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </MiniChartCard>

              <MiniChartCard title="Weekday Pattern">
                <ResponsiveContainer width="100%" height={108}>
                  <BarChart data={heatmap} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#e4e4e7" />
                    <XAxis dataKey="day" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#a855f7" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </MiniChartCard>
            </div>
          )}

          {(data.run.ai_summary || data.tasks.length > 0) && (
            <div className="grid gap-2 lg:grid-cols-12 lg:items-start">
              {data.run.ai_summary && (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3.5 lg:col-span-4">
                  <div className="flex gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100">
                      <Lightbulb className="h-3.5 w-3.5 text-emerald-700" />
                    </span>
                    <div>
                      <h2 className="text-[13px] font-semibold text-zinc-900">What this means</h2>
                      <p className="mt-1 text-[12px] leading-relaxed text-zinc-700">
                        {data.run.ai_summary}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {data.tasks.length > 0 && (
                <div className={cn("min-w-0", data.run.ai_summary ? "lg:col-span-8" : "lg:col-span-12")}>
                  <h2 className="mb-2 text-[13px] font-semibold text-zinc-900">Suggested tasks</h2>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {data.tasks.map((t, i) => {
                    const Icon = TASK_ICONS[i % TASK_ICONS.length];
                    const iconColor = TASK_ICON_COLORS[i % TASK_ICON_COLORS.length];
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => t.status !== "done" && void markTaskDone(t.id)}
                        className={cn(
                          momentumCardClass,
                          "flex h-full flex-col p-3 text-left transition hover:border-zinc-300/80 hover:bg-zinc-50/40",
                          t.status === "done" && "opacity-60"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className={cn(
                              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                              iconColor
                            )}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-300" />
                        </div>
                        <p
                          className={cn(
                            "mt-2 text-[12px] font-semibold leading-snug text-zinc-900",
                            t.status === "done" && "line-through"
                          )}
                        >
                          {t.title}
                        </p>
                        <p className="mt-0.5 line-clamp-2 flex-1 text-[11px] leading-relaxed text-zinc-500">
                          {t.description}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          <span
                            className={cn(
                              "rounded-md px-1.5 py-0.5 text-[9px] font-semibold capitalize",
                              priorityBadgeClass(t.priority)
                            )}
                          >
                            {t.priority}
                          </span>
                          <span
                            className={cn(
                              "rounded-md px-1.5 py-0.5 text-[9px] font-semibold capitalize",
                              impactBadgeClass(t.impact)
                            )}
                          >
                            {t.impact} impact
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            </div>
          )}
        </>
      )}
    </ModulePage>
  );
}

function MiniChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={cn(momentumCardClass, "p-3")}>
      <h3 className="mb-2 text-[11px] font-semibold tracking-tight text-zinc-800">{title}</h3>
      {children}
    </div>
  );
}
