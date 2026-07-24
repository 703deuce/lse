"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowUpRight, Calendar, ChevronRight, TrendingUp } from "lucide-react";
import {
  ModuleHeader,
  ModulePage,
  TabBar,
  cardClass,
  moduleStack,
} from "@/components/ui/design-system";
import { cn } from "@/lib/utils";
import {
  aggregateReviewAnalyticsTimeline,
  type ReviewAnalyticsData,
} from "@/lib/reviews/review-analytics-data";

const GREEN = "#137752";
const BLUE = "#3B82F6";

type TabId = "timeline" | "velocity" | "momentum";
type GroupMode = "daily" | "weekly" | "monthly";
type RangePreset = "30" | "60" | "90" | "custom";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "timeline", label: "Timeline" },
  { id: "velocity", label: "Velocity" },
  { id: "momentum", label: "Momentum" },
];

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn(cardClass, "p-4", className)}>{children}</div>;
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">{label}</p>
      <p className="mt-1.5 text-2xl font-bold tabular-nums text-zinc-900">{value}</p>
      {sub ? <p className="mt-1 text-[12px] text-zinc-500">{sub}</p> : null}
    </Card>
  );
}

function fmt(value: number | null | undefined, suffix = "") {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value}${suffix}`;
}

function DeltaText({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <span className={cn("text-[12px] font-medium", positive ? "text-emerald-600" : "text-red-600")}>
      {positive ? "+" : ""}
      {value}
    </span>
  );
}

export function ReviewAnalyticsDashboard({
  businessId,
  data,
}: {
  businessId: string;
  data: ReviewAnalyticsData;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("timeline");
  const [groupMode, setGroupMode] = useState<GroupMode>("daily");
  const [rangePreset, setRangePreset] = useState<RangePreset>("90");
  const [customStartDate, setCustomStartDate] = useState(data.timelinePoints[0]?.date ?? "");
  const [customEndDate, setCustomEndDate] = useState(data.timelinePoints[data.timelinePoints.length - 1]?.date ?? "");
  const [selectedCompetitorId, setSelectedCompetitorId] = useState<string>("average");
  const availableStartDate = data.timelinePoints[0]?.date ?? "";
  const availableEndDate = data.timelinePoints[data.timelinePoints.length - 1]?.date ?? "";
  const selectedCompetitor = data.competitors.find((competitor) => competitor.id === selectedCompetitorId);
  const rangeLabel =
    rangePreset === "custom"
      ? `${customStartDate || availableStartDate} to ${customEndDate || availableEndDate}`
      : `Last ${rangePreset} days`;
  const filteredTimelinePoints = useMemo(() => {
    if (rangePreset === "custom") {
      const start = customStartDate || availableStartDate;
      const end = customEndDate || availableEndDate;
      return data.timelinePoints.filter((point) => (!start || point.date >= start) && (!end || point.date <= end));
    }
    return data.timelinePoints.slice(-Number(rangePreset));
  }, [availableEndDate, availableStartDate, customEndDate, customStartDate, data.timelinePoints, rangePreset]);
  const comparisonTimelinePoints = useMemo(
    () =>
      filteredTimelinePoints.map((point) => ({
        ...point,
        competitorAvg:
          selectedCompetitorId === "average"
            ? point.competitorAvg
            : point.competitorSeries?.[selectedCompetitorId] ?? 0,
      })),
    [filteredTimelinePoints, selectedCompetitorId]
  );
  const timeline = useMemo(
    () => aggregateReviewAnalyticsTimeline(comparisonTimelinePoints, groupMode),
    [comparisonTimelinePoints, groupMode]
  );
  const markerLines = timeline.filter((point) => point.events.length > 0);
  const comparisonName =
    selectedCompetitorId === "average" ? "Competitor avg" : selectedCompetitor?.name ?? "Selected competitor";
  const velocityBars = data.rollingPeriods.map((period) => ({
    label: `${period.days}d`,
    current: period.current,
    prior: period.previous,
    deltaPct: period.deltaPct,
  }));

  return (
    <ModulePage className={moduleStack}>
      <ModuleHeader
        title="Review Analytics"
        subtitle={`Velocity, consistency, and momentum for ${data.businessName}.`}
        icon={TrendingUp}
        meta={
          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-[12px] font-medium text-zinc-600">
            <Calendar className="h-3.5 w-3.5" />
            {rangeLabel} · {data.timezone}
          </span>
        }
        actions={
          <Link
            href={`/businesses/${businessId}/reputation/overview`}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 text-[13px] font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50"
          >
            Overview
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        }
      />

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Rolling 7d" value={fmt(data.rolling7d)} sub={`${data.priorPeriod.rolling7dDelta >= 0 ? "+" : ""}${data.priorPeriod.rolling7dDelta} vs prior`} />
        <StatCard label="Rolling 30d" value={fmt(data.rolling30d)} sub={`${data.priorPeriod.rolling30dDelta >= 0 ? "+" : ""}${data.priorPeriod.rolling30dDelta} vs prior`} />
        <StatCard label="Rolling 60d" value={fmt(data.rolling60d)} sub={`${data.priorPeriod.rolling60dDelta >= 0 ? "+" : ""}${data.priorPeriod.rolling60dDelta} vs prior`} />
        <StatCard label="Response rate" value={fmt(data.responseRate, "%")} sub={data.avgResponseTimeDays == null ? "Response time unavailable" : `${data.avgResponseTimeDays}d avg response`} />
        <StatCard label="Avg Days Between" value={fmt(data.avgDaysBetweenReviews)} sub={`Median ${fmt(data.medianDaysBetweenReviews)} days`} />
        <StatCard label="Longest Drought" value={fmt(data.longestDroughtDays, "d")} sub={`${data.activeStreakDays}d active streak`} />
      </div>

      <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {activeTab === "timeline" ? (
        <Card>
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[14px] font-semibold text-zinc-900">Review timeline</h2>
              <p className="mt-0.5 text-[12px] text-zinc-500">Your review count vs selected competitor benchmark, with campaign and scan markers.</p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <div className="flex rounded-full bg-zinc-100 p-1">
                {(["30", "60", "90", "custom"] as const).map((range) => (
                  <button
                    key={range}
                    type="button"
                    onClick={() => setRangePreset(range)}
                    className={cn(
                      "rounded-full px-3 py-1 text-[12px] font-semibold capitalize",
                      rangePreset === range ? "bg-white text-[#137752] shadow-sm" : "text-zinc-500"
                    )}
                  >
                    {range === "custom" ? "Custom" : `${range}d`}
                  </button>
                ))}
              </div>
              <select
                value={selectedCompetitorId}
                onChange={(event) => setSelectedCompetitorId(event.target.value)}
                className="h-8 rounded-full border border-zinc-200 bg-white px-3 text-[12px] font-semibold text-zinc-700 shadow-sm"
              >
                <option value="average">Average</option>
                {data.competitors.map((competitor) => (
                  <option key={competitor.id} value={competitor.id}>
                    {competitor.name}
                  </option>
                ))}
              </select>
              <div className="flex rounded-full bg-zinc-100 p-1">
                {data.groupModes.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setGroupMode(mode)}
                    className={cn(
                      "rounded-full px-3 py-1 text-[12px] font-semibold capitalize",
                      groupMode === mode ? "bg-white text-[#137752] shadow-sm" : "text-zinc-500"
                    )}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {rangePreset === "custom" ? (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl bg-zinc-50 p-3 text-[12px] text-zinc-600">
              <span className="font-semibold text-zinc-700">Custom range</span>
              <input
                type="date"
                value={customStartDate}
                min={availableStartDate}
                max={availableEndDate}
                onChange={(event) => setCustomStartDate(event.target.value)}
                className="h-8 rounded-lg border border-zinc-200 bg-white px-2 text-[12px]"
              />
              <span>to</span>
              <input
                type="date"
                value={customEndDate}
                min={availableStartDate}
                max={availableEndDate}
                onChange={(event) => setCustomEndDate(event.target.value)}
                className="h-8 rounded-lg border border-zinc-200 bg-white px-2 text-[12px]"
              />
              <span className="text-zinc-400">Loaded window: {availableStartDate} to {availableEndDate}</span>
            </div>
          ) : null}
          <div className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeline} margin={{ top: 10, right: 18, left: -12, bottom: 0 }}>
                <CartesianGrid stroke="#F4F4F5" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#71717A" }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#71717A" }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E4E4E7", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {markerLines.map((point) => (
                  <ReferenceLine
                    key={`${point.date}-${point.events.map((event) => event.id).join("-")}`}
                    x={point.date}
                    stroke={point.events.some((event) => event.type === "campaign_start") ? "#F59E0B" : "#8B5CF6"}
                    strokeDasharray="3 3"
                    label={{ value: point.events.length > 1 ? `${point.events.length} events` : point.events[0]?.type === "campaign_start" ? "Campaign" : "Scan", fontSize: 10, fill: "#71717A" }}
                  />
                ))}
                <Line type="monotone" dataKey="you" name="You" stroke={GREEN} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="competitorAvg" name={comparisonName} stroke={BLUE} strokeWidth={2} strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      ) : null}

      {activeTab === "velocity" ? (
        <div className="grid gap-2 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <h2 className="text-[14px] font-semibold text-zinc-900">Current vs prior period</h2>
            <div className="mt-3 h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={velocityBars} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke="#F4F4F5" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#71717A" }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#71717A" }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E4E4E7", fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="current" name="Current" fill={GREEN} radius={[8, 8, 0, 0]} />
                  <Bar dataKey="prior" name="Prior" fill="#CBD5E1" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card>
            <h2 className="text-[14px] font-semibold text-zinc-900">Velocity snapshot</h2>
            <div className="mt-4 space-y-3 text-[13px]">
              <div className="flex justify-between gap-2">
                <span className="text-zinc-500">Weekly velocity</span>
                <span className="font-semibold text-zinc-900">{data.weeklyVelocity} reviews</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-zinc-500">Monthly velocity</span>
                <span className="font-semibold text-zinc-900">{data.monthlyVelocity} reviews</span>
              </div>
              {data.rollingPeriods.map((period) => (
                <div key={period.days} className="flex justify-between gap-2">
                  <span className="text-zinc-500">{period.days}d delta</span>
                  <span className="font-semibold">
                    <DeltaText value={period.delta} />{" "}
                    <span className="text-zinc-400">
                      {period.deltaPct == null ? "" : `(${period.deltaPct >= 0 ? "+" : ""}${period.deltaPct}%)`}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : null}

      {activeTab === "momentum" ? (
        <div className="grid gap-2 lg:grid-cols-3">
          <Card className="border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-white lg:col-span-2">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-[#137752]">
                <ArrowUpRight className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-emerald-700">Momentum</p>
                <h2 className="mt-1 text-xl font-bold text-zinc-900">{data.momentumStatus}</h2>
                <p className="mt-2 text-[13px] leading-relaxed text-zinc-700">{data.explanation}</p>
                {data.momentumLabel !== data.momentumStatus ? (
                  <p className="mt-1 text-[12px] text-zinc-500">Latest audit label: {data.momentumLabel}</p>
                ) : null}
                <p className="mt-2 text-[13px] leading-relaxed text-zinc-600">{data.competitorRelative}</p>
              </div>
            </div>
          </Card>
          <Card>
            <h2 className="text-[14px] font-semibold text-zinc-900">Consistency</h2>
            <dl className="mt-4 space-y-3 text-[13px]">
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Acceleration</dt>
                <dd className="font-semibold text-zinc-900">{fmt(data.accelerationPct, "%")}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Avg days between</dt>
                <dd className="font-semibold text-zinc-900">{fmt(data.avgDaysBetweenReviews)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Longest drought</dt>
                <dd className="font-semibold text-zinc-900">{fmt(data.longestDroughtDays, "d")}</dd>
              </div>
            </dl>
          </Card>
          <Card className="lg:col-span-3">
            <h2 className="text-[14px] font-semibold text-zinc-900">Momentum drivers</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {data.drivers.map((driver) => (
                <span key={driver} className="rounded-full bg-zinc-100 px-3 py-1 text-[12px] font-medium text-zinc-700">
                  {driver}
                </span>
              ))}
            </div>
          </Card>
        </div>
      ) : null}
    </ModulePage>
  );
}
