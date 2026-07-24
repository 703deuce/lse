"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowUpRight, Clock, Flame, Table2, TrendingUp } from "lucide-react";
import {
  RepBadge,
  RepMetricCard,
  RepPageHeader,
  RepTabs,
  rep,
} from "@/components/reputation/rep-ui";
import {
  aggregateReviewAnalyticsTimeline,
  type GroupMode,
  type ReviewAnalyticsData,
} from "@/lib/reviews/review-analytics-data";
import { cn } from "@/lib/utils";

const GREEN = "#137752";
const BLUE = "#2563EB";
const PURPLE = "#7C3AED";
const GRID = "#EEF2F6";

type TabId = "timeline" | "velocity" | "momentum";

export type ReviewAnalyticsDashboardData = ReviewAnalyticsData & {
  totalReviews?: number;
  dateRangeLabel?: string;
  momentumScore?: number;
  periodRows?: Array<{
    label: string;
    reviews: number;
    previous: number;
    delta: number;
    deltaPct: number | null;
  }>;
};

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "timeline", label: "Timeline" },
  { id: "velocity", label: "Velocity" },
  { id: "momentum", label: "Momentum" },
];

function fmt(value: number | null | undefined, suffix = ""): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value)}${suffix}`;
}

function signed(value: number | null | undefined, suffix = ""): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value >= 0 ? "+" : "-"}${fmt(Math.abs(value), suffix)}`;
}

function Card({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn(rep.card, "p-4", className)}>
      {title || action ? (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title ? <h2 className="text-base font-semibold text-[#101828]">{title}</h2> : null}
            {subtitle ? <p className="mt-0.5 text-xs text-[#667085]">{subtitle}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

function PeriodTable({ rows }: { rows: NonNullable<ReviewAnalyticsDashboardData["periodRows"]> }) {
  return (
    <Card title="Reviews by Period" subtitle="Current period compared with the previous matching window.">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#F9FAFB] text-[11px] uppercase tracking-[0.06em] text-[#98A2B3]">
            <tr>
              <th className="px-3 py-2 font-semibold">Period</th>
              <th className="px-3 py-2 font-semibold">Reviews</th>
              <th className="px-3 py-2 font-semibold">Previous</th>
              <th className="px-3 py-2 font-semibold">Delta</th>
              <th className="px-3 py-2 font-semibold">Change</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-[#F2F4F7]">
                <td className="px-3 py-3 font-medium text-[#101828]">{row.label}</td>
                <td className="px-3 py-3 tabular-nums text-[#344054]">{row.reviews}</td>
                <td className="px-3 py-3 tabular-nums text-[#667085]">{row.previous}</td>
                <td className={cn("px-3 py-3 tabular-nums font-semibold", row.delta >= 0 ? "text-[#027A48]" : "text-[#B42318]")}>
                  {signed(row.delta)}
                </td>
                <td className="px-3 py-3 tabular-nums text-[#667085]">
                  {row.deltaPct == null ? "—" : signed(row.deltaPct, "%")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function VelocitySnapshot({ data }: { data: ReviewAnalyticsDashboardData }) {
  const metrics = [
    ["Reviews / week", fmt(data.weeklyVelocity)],
    ["Reviews / month", fmt(data.monthlyVelocity)],
    ["Median days", fmt(data.medianDaysBetweenReviews)],
    ["Longest drought", fmt(data.longestDroughtDays, "d")],
    ["Active streak", fmt(data.activeStreakDays, "d")],
  ];

  return (
    <Card title="Review Velocity 30d" subtitle="How consistently new reviews are arriving.">
      <div className="rounded-xl bg-[#ECFDF3] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#027A48]">
          Monthly Velocity
        </p>
        <p className="mt-1 text-3xl font-bold tracking-tight text-[#101828]">
          {fmt(data.monthlyVelocity)}
        </p>
        <p className="mt-1 text-xs text-[#667085]">reviews in the last 30 days</p>
      </div>
      <dl className="mt-4 space-y-3">
        {metrics.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 text-sm">
            <dt className="text-[#667085]">{label}</dt>
            <dd className="font-semibold tabular-nums text-[#101828]">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function MomentumCard({ data }: { data: ReviewAnalyticsDashboardData }) {
  const score = data.momentumScore ?? Math.max(0, Math.min(100, Math.round((data.accelerationPct ?? 0) + 65)));

  return (
    <Card title="Momentum" subtitle="Signals behind the current review growth trend.">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <RepBadge tone={data.momentumStatus === "Accelerating" ? "green" : data.momentumStatus === "Slowing" ? "amber" : "gray"}>
            {data.momentumStatus}
          </RepBadge>
          <p className="mt-3 text-4xl font-bold tracking-tight text-[#101828]">{score}/100</p>
          <p className="mt-1 text-sm text-[#667085]">{data.explanation}</p>
        </div>
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#ECFDF3] text-[#137752]">
          <Flame className="h-6 w-6" />
        </span>
      </div>
      <div className="mt-4 space-y-2">
        {data.drivers.map((driver) => (
          <div key={driver} className="flex items-start gap-2 rounded-lg bg-[#F9FAFB] px-3 py-2 text-sm text-[#344054]">
            <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-[#137752]" />
            {driver}
          </div>
        ))}
      </div>
    </Card>
  );
}

export function ReviewAnalyticsDashboard({
  data,
}: {
  businessId: string;
  data: ReviewAnalyticsDashboardData;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("timeline");
  const [groupMode, setGroupMode] = useState<GroupMode>("daily");

  const periodRows = useMemo(
    () =>
      data.periodRows ??
      data.rollingPeriods.map((period) => ({
        label: `${period.days} days`,
        reviews: period.current,
        previous: period.previous,
        delta: period.delta,
        deltaPct: period.deltaPct,
      })),
    [data.periodRows, data.rollingPeriods]
  );

  const chartData = useMemo(() => {
    const aggregated = aggregateReviewAnalyticsTimeline(data.timelinePoints, groupMode);
    const firstCompetitor = data.competitors[0]?.id;
    const secondCompetitor = data.competitors[1]?.id;
    return aggregated.map((point) => ({
      ...point,
      topCompetitor:
        (firstCompetitor ? point.competitorSeries?.[firstCompetitor] : undefined) ??
        point.competitorAvg ??
        0,
      secondCompetitor:
        (secondCompetitor ? point.competitorSeries?.[secondCompetitor] : undefined) ??
        Math.max(0, Math.round((point.competitorAvg ?? 0) * 0.75)),
    }));
  }, [data.competitors, data.timelinePoints, groupMode]);

  const dailyVolume = useMemo(
    () =>
      data.timelinePoints.slice(-30).map((point) => ({
        date: point.date.slice(5),
        reviews: point.you,
      })),
    [data.timelinePoints]
  );

  const totalReviews = data.totalReviews ?? data.timelinePoints.reduce((sum, point) => sum + point.you, 0);
  const events = chartData.filter((point) => point.events.length > 0);
  const topCompetitorName = data.competitors[0]?.name ?? "Top Competitor";
  const secondCompetitorName = data.competitors[1]?.name ?? "2nd Competitor";

  const kpis = (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <RepMetricCard label="Total Reviews" value={fmt(totalReviews)} hint="all-time Google reviews" />
      <RepMetricCard label="Reviews 7d" value={fmt(data.rolling7d)} trend={signed(data.priorPeriod.rolling7dDelta)} hint="vs previous 7d" trendPositive={data.priorPeriod.rolling7dDelta >= 0} />
      <RepMetricCard label="Reviews 30d" value={fmt(data.rolling30d)} trend={signed(data.priorPeriod.rolling30dDelta)} hint="vs previous 30d" trendPositive={data.priorPeriod.rolling30dDelta >= 0} />
      <RepMetricCard label="Reviews 60d" value={fmt(data.rolling60d)} trend={signed(data.priorPeriod.rolling60dDelta)} hint="vs previous 60d" trendPositive={data.priorPeriod.rolling60dDelta >= 0} />
      <RepMetricCard label="Reviews 90d" value={fmt(data.rolling90d)} trend={signed(data.priorPeriod.rolling90dDelta)} hint="vs previous 90d" trendPositive={data.priorPeriod.rolling90dDelta >= 0} />
      <RepMetricCard label="Avg Days Between" value={fmt(data.avgDaysBetweenReviews)} hint={`Median ${fmt(data.medianDaysBetweenReviews)} days`} />
    </div>
  );

  const timelineChart = (
    <Card
      title="Reviews Over Time"
      subtitle="You vs competitor review velocity with campaign and Maps scan markers."
      action={
        <div className="flex rounded-lg bg-[#F2F4F7] p-1">
          {(["daily", "weekly", "monthly"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setGroupMode(mode)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-semibold capitalize",
                groupMode === mode ? "bg-white text-[#137752] shadow-sm" : "text-[#667085]"
              )}
            >
              {mode === "daily" ? "Day" : mode === "weekly" ? "Week" : "Month"}
            </button>
          ))}
        </div>
      }
    >
      <div className="h-[380px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 18, left: -12, bottom: 0 }}>
            <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#667085" }} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#667085" }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E6EAF0", fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {events.map((point) => (
              <ReferenceLine
                key={`${point.date}-${point.events.map((event) => event.id).join("-")}`}
                x={point.date}
                stroke={point.events.some((event) => event.type === "campaign_start") ? "#F79009" : "#7C3AED"}
                strokeDasharray="3 3"
                label={{ value: point.events[0]?.type === "campaign_start" ? "Campaign" : "Maps", fontSize: 10, fill: "#667085" }}
              />
            ))}
            <Line type="monotone" dataKey="you" name="You" stroke={GREEN} strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
            <Line type="monotone" dataKey="topCompetitor" name={topCompetitorName} stroke={BLUE} strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="secondCompetitor" name={secondCompetitorName} stroke={PURPLE} strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );

  const volumeChart = (
    <Card title="Daily Review Volume" subtitle="Last 30 days">
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dailyVolume} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
            <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#667085" }} tickLine={false} axisLine={false} minTickGap={12} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#667085" }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E6EAF0", fontSize: 12 }} />
            <Bar dataKey="reviews" name="Reviews" radius={[6, 6, 0, 0]}>
              {dailyVolume.map((point) => (
                <Cell key={point.date} fill={point.reviews > 0 ? GREEN : "#D0D5DD"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );

  return (
    <div className={rep.page}>
      <RepPageHeader
        title="Review Analytics"
        subtitle="Track review growth, velocity, and momentum over time."
        dateRangeLabel={data.dateRangeLabel ?? "Last 90 days"}
        showCompare
        filterLabel="Filters"
      />

      <RepTabs tabs={tabs} active={activeTab} onChange={(tab) => setActiveTab(tab as TabId)} />

      {activeTab === "timeline" ? (
        <>
          {kpis}
          <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_360px]">
            {timelineChart}
            <VelocitySnapshot data={data} />
          </div>
          <div className="grid gap-4 xl:grid-cols-3">
            <PeriodTable rows={periodRows} />
            {volumeChart}
            <MomentumCard data={data} />
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-[#F9FAFB] px-3 py-2 text-xs text-[#667085]">
            <Clock className="mt-0.5 h-3.5 w-3.5" />
            Review timestamps are normalized to {data.timezone}. Campaign and Maps markers reflect observed event dates.
          </div>
        </>
      ) : null}

      {activeTab === "velocity" ? (
        <>
          {kpis}
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            {volumeChart}
            <VelocitySnapshot data={data} />
          </div>
          <PeriodTable rows={periodRows} />
        </>
      ) : null}

      {activeTab === "momentum" ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <MomentumCard data={data} />
          <Card title="Momentum Factors" subtitle="Signals contributing to the current score.">
            <div className="space-y-3">
              {data.drivers.map((driver) => (
                <div key={driver} className="flex items-start gap-3 rounded-xl border border-[#E6EAF0] bg-white p-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ECFDF3] text-[#137752]">
                    <TrendingUp className="h-4 w-4" />
                  </span>
                  <p className="text-sm leading-6 text-[#344054]">{driver}</p>
                </div>
              ))}
              <div className="rounded-xl bg-[#F9FAFB] p-4 text-sm leading-6 text-[#667085]">
                {data.competitorRelative}
              </div>
            </div>
          </Card>
          <Card title="Reviews by Period" className="xl:col-span-2">
            <div className="flex items-center gap-2 text-sm text-[#667085]">
              <Table2 className="h-4 w-4 text-[#137752]" />
              Use the Timeline tab for the full period table and daily volume chart.
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
