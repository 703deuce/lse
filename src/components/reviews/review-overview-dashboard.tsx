"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Calendar,
  ChevronRight,
  MessageSquare,
  Plus,
  Shield,
  Star,
  Trophy,
  Zap,
} from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Sparkline } from "@/components/overview/overview-charts";
import {
  ModulePage,
  cardClass,
  moduleStack,
} from "@/components/ui/design-system";
import { cn } from "@/lib/utils";
import type { ReviewOverviewData } from "@/lib/reviews/review-overview-preview-data";

const GREEN = "#137752";
const GREEN_SOFT = "#ECFDF3";
const BLUE = "#3B82F6";
const GREY_LINE = "#A1A1AA";

function YellowStars({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.25 && rating - full < 0.75;
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} stars`}>
      {Array.from({ length: 5 }).map((_, i) => {
        const filled = i < full || (i === full && half);
        return (
          <Star
            key={i}
            className={cn(
              "h-3.5 w-3.5",
              filled ? "fill-[#FDB022] text-[#FDB022]" : "fill-zinc-200 text-zinc-200"
            )}
          />
        );
      })}
    </span>
  );
}

function DeltaPct({ value, suffix }: { value: number; suffix: string }) {
  const positive = value >= 0;
  return (
    <p className={cn("mt-1 text-[11px] font-medium leading-snug", positive ? "text-emerald-600" : "text-red-600")}>
      {positive ? "+" : ""}
      {value}% {suffix}
    </p>
  );
}

function SoftCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn(cardClass, "p-4", className)}>{children}</div>;
}

function CardLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">{children}</p>
  );
}

function ViewLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-0.5 text-[12px] font-semibold text-[#137752] hover:underline"
    >
      {children}
      <ChevronRight className="h-3.5 w-3.5" />
    </Link>
  );
}

function ResponseRing({ pct, showLabel = false }: { pct: number; showLabel?: boolean }) {
  const size = 52;
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, pct));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#E4E4E7"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={GREEN}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      {showLabel ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold tabular-nums text-zinc-900">{Math.round(clamped)}%</span>
        </div>
      ) : null}
    </div>
  );
}

function ClickIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M9 9l5.5 12 1.7-5.3L21.5 14.5 9 9z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M4 4l5 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function ReviewOverviewDashboard({
  businessId,
  data,
}: {
  businessId: string;
  data: ReviewOverviewData;
}) {
  const analyticsHref = `/businesses/${businessId}/review-momentum`;
  const competitorsHref = `/businesses/${businessId}/reviews?tab=competitor-reviews`;
  const mapsHref = `/businesses/${businessId}/scans`;
  const campaignsHref = `/businesses/${businessId}/review-campaigns`;
  const unansweredHref = `/businesses/${businessId}/reviews?tab=unanswered`;

  return (
    <ModulePage className={moduleStack}>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Review Overview</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-[13px] font-medium text-zinc-700 shadow-sm"
          >
            <Calendar className="h-3.5 w-3.5 text-zinc-400" />
            {data.dateRangeLabel}
          </button>
          <button
            type="button"
            className="inline-flex h-9 items-center rounded-lg border border-zinc-200 bg-white px-3.5 text-[13px] font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50"
          >
            Show Report
          </button>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#137752] px-3.5 text-[13px] font-semibold text-white shadow-[0_4px_14px_rgba(19,119,82,0.28)] hover:bg-[#0f6244]"
          >
            <Plus className="h-3.5 w-3.5" />
            Quick Action
          </button>
        </div>
      </div>

      {/* Row 1 — six KPIs */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <SoftCard>
          <CardLabel>Google Rating</CardLabel>
          <div className="mt-1.5 flex items-end gap-2">
            <span className="text-2xl font-bold tabular-nums leading-none text-zinc-900">
              {data.googleRating.toFixed(1)}
            </span>
            <YellowStars rating={data.googleRating} />
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-zinc-500">
            vs {data.competitorAvgRatingNearby.toFixed(1)} avg in {data.nearbyMiles} mi
          </p>
        </SoftCard>

        <SoftCard>
          <CardLabel>Total Reviews</CardLabel>
          <p className="mt-1.5 text-2xl font-bold tabular-nums leading-none text-zinc-900">
            {data.totalReviews}
          </p>
          <p className="mt-1.5 text-[11px] font-medium leading-snug text-emerald-600">
            + {data.gained30d} in last 30 days
          </p>
        </SoftCard>

        <SoftCard>
          <CardLabel>Reviews (7 Days)</CardLabel>
          <p className="mt-1.5 text-2xl font-bold tabular-nums leading-none text-zinc-900">
            {data.reviews7d}
          </p>
          <DeltaPct value={data.reviews7dDeltaPct} suffix="vs previous 7 days" />
        </SoftCard>

        <SoftCard>
          <CardLabel>Reviews (30 Days)</CardLabel>
          <p className="mt-1.5 text-2xl font-bold tabular-nums leading-none text-zinc-900">
            {data.reviews30d}
          </p>
          <DeltaPct value={data.reviews30dDeltaPct} suffix="vs previous 30 days" />
        </SoftCard>

        <SoftCard>
          <CardLabel>Reviews (60 Days)</CardLabel>
          <p className="mt-1.5 text-2xl font-bold tabular-nums leading-none text-zinc-900">
            {data.reviews60d}
          </p>
          <DeltaPct value={data.reviews60dDeltaPct} suffix="vs previous 60 days" />
        </SoftCard>

        <SoftCard>
          <CardLabel>Reviews (90 Days)</CardLabel>
          <p className="mt-1.5 text-2xl font-bold tabular-nums leading-none text-zinc-900">
            {data.reviews90d}
          </p>
          <DeltaPct value={data.reviews90dDeltaPct} suffix="vs previous 90 days" />
        </SoftCard>
      </div>

      {/* Row 2 — insight cards */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <SoftCard>
          <CardLabel>Review Velocity</CardLabel>
          <div className="mt-2 flex items-start justify-between gap-2">
            <div>
              <p className="text-[15px] font-bold tabular-nums leading-tight text-zinc-900">
                {data.reviewsPerWeek} reviews / week
              </p>
              <p className="mt-0.5 text-[13px] font-semibold tabular-nums text-zinc-700">
                {data.reviewsPerMonth} reviews / month
              </p>
            </div>
            <Sparkline data={data.velocitySparkline} color={GREEN} width={64} height={28} />
          </div>
          <p className="mt-2 text-[11px] leading-snug text-zinc-500">
            vs {data.reviewsPerWeekBaseline90d} avg last 90 days
          </p>
        </SoftCard>

        <SoftCard>
          <CardLabel>Momentum</CardLabel>
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF3] px-2.5 py-1 text-[13px] font-semibold text-[#137752]">
            <ArrowUpRight className="h-3.5 w-3.5" />
            {data.momentumLabel}
          </div>
          <p className="mt-2 text-[12px] font-medium text-zinc-700">{data.momentumSubtitle}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-zinc-500">{data.momentumDetail}</p>
        </SoftCard>

        <SoftCard>
          <CardLabel>Competitor Position</CardLabel>
          <p className="mt-2 text-2xl font-bold tabular-nums leading-none text-zinc-900">
            #{data.competitorRank}{" "}
            <span className="text-base font-semibold text-zinc-500">of {data.competitorPoolSize}</span>
          </p>
          <p className="mt-1.5 text-[11px] font-medium text-emerald-600">
            +{data.competitorRankDelta} vs last month
          </p>
          <div className="mt-2">
            <ViewLink href={competitorsHref}>View Rankings</ViewLink>
          </div>
        </SoftCard>

        <SoftCard>
          <CardLabel>Response Rate</CardLabel>
          <div className="mt-2 flex items-center gap-3">
            <span className="text-2xl font-bold tabular-nums leading-none text-zinc-900">
              {data.responseRatePct}%
            </span>
            <ResponseRing pct={data.responseRatePct} />
          </div>
          <p className="mt-2 text-[11px] leading-snug text-zinc-500">
            {data.answeredCount} of {data.answeredOf} reviews answered
          </p>
        </SoftCard>

        <SoftCard className="border-red-100 bg-gradient-to-br from-white to-red-50/40">
          <CardLabel>Unanswered Negative</CardLabel>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-3xl font-bold tabular-nums leading-none text-red-600">
              {data.unansweredNegative}
            </span>
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </div>
          <p className="mt-1.5 text-[11px] font-medium text-red-600">Needs immediate response</p>
          <div className="mt-2">
            <ViewLink href={unansweredHref}>View Reviews</ViewLink>
          </div>
        </SoftCard>
      </div>

      {/* Row 3 — charts + lists */}
      <div className="grid grid-cols-1 gap-2 xl:grid-cols-3">
        <SoftCard className="xl:col-span-1">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <h2 className="text-[14px] font-semibold text-zinc-900">Review Trend (90 days)</h2>
            </div>
            <ViewLink href={analyticsHref}>View Full Analytics</ViewLink>
          </div>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.trendSeries} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F4F4F5" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "#A1A1AA" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 10, fill: "#A1A1AA" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 10,
                    border: "1px solid #E4E4E7",
                    fontSize: 12,
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={28}
                  iconType="circle"
                  wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="you"
                  name="You"
                  stroke={GREEN}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="benchmark"
                  name="Benchmark"
                  stroke={BLUE}
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="competitor"
                  name="Competitor"
                  stroke={GREY_LINE}
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SoftCard>

        <SoftCard>
          <div className="mb-3 flex items-start justify-between gap-2">
            <h2 className="text-[14px] font-semibold text-zinc-900">
              Review Impact vs Competitors (90 days)
            </h2>
            <ViewLink href={competitorsHref}>See All Competitors</ViewLink>
          </div>
          <ul className="space-y-3.5">
            {data.impactRows.map((row) => (
              <li key={row.name}>
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <div className="min-w-0 truncate">
                    <span
                      className={cn(
                        "text-[13px] font-semibold",
                        row.isYou ? "text-zinc-900" : "text-zinc-700"
                      )}
                    >
                      {row.name}
                    </span>
                    <span className="ml-1.5 text-[12px] font-bold tabular-nums text-zinc-900">
                      +{row.reviewsGained} reviews
                    </span>
                    {row.status ? (
                      <span
                        className={cn(
                          "ml-1.5 text-[11px] font-medium",
                          row.isYou ? "text-emerald-600" : "text-zinc-500"
                        )}
                      >
                        ({row.status})
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      row.isYou ? "bg-[#137752]" : "bg-zinc-300"
                    )}
                    style={{ width: `${row.barPct}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </SoftCard>

        <SoftCard>
          <div className="mb-3 flex items-start justify-between gap-2">
            <h2 className="text-[14px] font-semibold text-zinc-900">Maps Visibility (30 days)</h2>
            <ViewLink href={mapsHref}>View Full Maps Profile</ViewLink>
          </div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium text-zinc-500">Avg Ranking</p>
              <p className="mt-0.5 text-2xl font-bold tabular-nums text-zinc-900">
                {data.mapsAvgRank.toFixed(1)}
              </p>
              <p className="mt-1 text-[11px] font-medium text-emerald-600">
                +{data.mapsAvgRankDelta.toFixed(1)} in last 30 days
              </p>
            </div>
            <Sparkline data={data.mapsRankSparkline} color={GREEN} width={88} height={36} />
          </div>
          <div className="mt-4 space-y-2 border-t border-zinc-100 pt-3">
            <div className="flex items-center justify-between gap-2 text-[13px]">
              <span className="text-zinc-600">Top 3 Visibility</span>
              <span className="font-semibold tabular-nums text-zinc-900">
                {data.top3VisibilityPct}%{" "}
                <span className="text-[11px] font-medium text-emerald-600">
                  +{data.top3VisibilityDelta}%
                </span>
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 text-[13px]">
              <span className="text-zinc-600">Top 10 Visibility</span>
              <span className="font-semibold tabular-nums text-zinc-900">
                {data.top10VisibilityPct}%{" "}
                <span
                  className={cn(
                    "text-[11px] font-medium",
                    data.top10VisibilityDelta >= 0 ? "text-emerald-600" : "text-red-600"
                  )}
                >
                  {data.top10VisibilityDelta >= 0 ? "+" : ""}
                  {data.top10VisibilityDelta}%
                </span>
              </span>
            </div>
          </div>
        </SoftCard>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 gap-2 xl:grid-cols-5">
        <SoftCard className="xl:col-span-3">
          <div className="mb-4 flex items-start justify-between gap-2">
            <h2 className="text-[14px] font-semibold text-zinc-900">
              Campaign Performance (Last 30 days)
            </h2>
            <ViewLink href={campaignsHref}>View All Campaigns</ViewLink>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <CampaignStat
              icon={<MessageSquare className="h-4 w-4" />}
              value={String(data.campaign.sent)}
              label="Sent"
            />
            <CampaignStat
              icon={<ClickIcon className="h-4 w-4" />}
              value={`${data.campaign.clickedPct}%`}
              label={`(${data.campaign.clickedCount}) Clicked`}
            />
            <CampaignStat
              icon={<Star className="h-4 w-4" />}
              value={String(data.campaign.reviews)}
              label="reviews"
            />
            <CampaignStat
              icon={<Shield className="h-4 w-4" />}
              value={String(data.campaign.badReviews)}
              label="bad reviews"
            />
            <CampaignStat
              icon={<Trophy className="h-4 w-4" />}
              value={`${data.campaign.convRatePct}%`}
              label="Conv. Rate"
            />
          </div>
        </SoftCard>

        <SoftCard className="border-[#D1FAE5] bg-gradient-to-br from-[#ECFDF3]/80 to-white xl:col-span-2">
          <div className="flex gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: GREEN_SOFT, color: GREEN }}
            >
              <Zap className="h-5 w-5 fill-current" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
                Recommended Next Action
              </p>
              <h3 className="mt-1 text-[15px] font-bold text-zinc-900">{data.nextAction.title}</h3>
              <p className="mt-1 text-[13px] leading-snug text-zinc-600">{data.nextAction.body}</p>
              <Link
                href={unansweredHref}
                className="mt-3 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-[#137752] px-4 text-[13px] font-semibold text-white shadow-[0_4px_14px_rgba(19,119,82,0.28)] hover:bg-[#0f6244] sm:w-auto"
              >
                {data.nextAction.ctaLabel}
                <ChevronRight className="h-4 w-4" />
              </Link>
              <button
                type="button"
                className="mt-2 block text-[12px] font-medium text-zinc-500 hover:text-zinc-700"
              >
                Dismiss Suggestion
              </button>
            </div>
          </div>
        </SoftCard>
      </div>
    </ModulePage>
  );
}

function CampaignStat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: GREEN_SOFT, color: GREEN }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[15px] font-bold tabular-nums leading-none text-zinc-900">{value}</p>
        <p className="mt-1 text-[11px] leading-snug text-zinc-500">{label}</p>
      </div>
    </div>
  );
}
