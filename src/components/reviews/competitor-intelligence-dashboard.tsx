"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownRight, ArrowUpRight, Plus, Star, Trophy, Users } from "lucide-react";
import {
  RepBadge,
  RepMetricCard,
  RepPageHeader,
  RepTabs,
  rep,
} from "@/components/reputation/rep-ui";
import type {
  CompetitorIntelligenceData,
  CompetitorLeaderboardRow,
} from "@/lib/reviews/competitor-intelligence-data";
import { cn } from "@/lib/utils";

const GREEN = "#137752";
const BLUE = "#2563EB";
const GRID = "#EEF2F6";

type TabId = "leaderboard" | "gap" | "strengths" | "content" | "platforms";

export type CompetitorIntelligenceDashboardData = Omit<CompetitorIntelligenceData, "leaderboardRows"> & {
  dateRangeLabel?: string;
  leaderboardRows: Array<
    CompetitorLeaderboardRow & {
      deltas?: {
        reviews30?: number;
        reviews60?: number;
        reviews90?: number;
      };
    }
  >;
  opportunities?: string[];
};

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "leaderboard", label: "Leaderboard" },
  { id: "gap", label: "Review Gap" },
  { id: "strengths", label: "Strengths & Weaknesses" },
  { id: "content", label: "Content Comparison" },
  { id: "platforms", label: "Platform Presence" },
];

function fmt(value: number | null | undefined, digits = 0): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function signed(value: number | null | undefined, suffix = ""): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value >= 0 ? "+" : "-"}${fmt(Math.abs(value), 0)}${suffix}`;
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

function Rating({ value }: { value: number | null }) {
  return (
    <span className="inline-flex items-center gap-1 font-semibold text-[#101828]">
      {fmt(value, 1)}
      <Star className="h-3.5 w-3.5 fill-[#FDB022] text-[#FDB022]" />
    </span>
  );
}

function MomentumPill({ label }: { label: string }) {
  const lower = label.toLowerCase();
  const tone =
    lower.includes("acceler") || lower.includes("explod")
      ? "green"
      : lower.includes("slow") || lower.includes("stall")
        ? "amber"
        : "gray";
  return <RepBadge tone={tone}>{label}</RepBadge>;
}

function ResponseRing({ pct }: { pct: number }) {
  const size = 38;
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, pct));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="-rotate-90" width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#E6EAF0" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={GREEN}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-[#101828]">
        {Math.round(clamped)}%
      </span>
    </div>
  );
}

function LeaderboardTable({
  rows,
  businessId,
}: {
  rows: CompetitorIntelligenceDashboardData["leaderboardRows"];
  businessId: string;
}) {
  return (
    <Card
      title="Full Leaderboard"
      subtitle="Ranked by total Google review count."
      action={
        <button
          type="button"
          onClick={() => {
            window.location.href = `/businesses/${businessId}/reputation/settings`;
          }}
          className={rep.btnSecondary}
        >
          <Plus className="h-4 w-4" />
          Add / Manage Competitors
        </button>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-[#F9FAFB] text-[11px] uppercase tracking-[0.06em] text-[#98A2B3]">
            <tr>
              <th className="px-3 py-2 font-semibold">Rank</th>
              <th className="px-3 py-2 font-semibold">Business</th>
              <th className="px-3 py-2 font-semibold">Total</th>
              <th className="px-3 py-2 font-semibold">Rating</th>
              <th className="px-3 py-2 font-semibold">30 / 60 / 90</th>
              <th className="px-3 py-2 font-semibold">Reviews / mo</th>
              <th className="px-3 py-2 font-semibold">Momentum</th>
              <th className="px-3 py-2 font-semibold">Response</th>
              <th className="px-3 py-2 font-semibold">Avg Response</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={row.id}
                className={cn("border-b border-[#F2F4F7]", row.isYou && "bg-[#ECFDF3]")}
              >
                <td className="px-3 py-3 font-bold tabular-nums text-[#101828]">#{index + 1}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold",
                        row.isYou ? "bg-white text-[#137752]" : "bg-[#F2F4F7] text-[#667085]"
                      )}
                    >
                      {row.isYou ? "You" : row.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <p className="font-semibold text-[#101828]">{row.isYou ? "You" : row.name}</p>
                      {row.isYou ? <p className="text-xs text-[#667085]">{row.name}</p> : null}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 font-semibold tabular-nums text-[#101828]">{fmt(row.totalReviews)}</td>
                <td className="px-3 py-3"><Rating value={row.rating} /></td>
                <td className="px-3 py-3">
                  <div className="flex gap-2 tabular-nums text-[#344054]">
                    <span>{row.reviews30}<small className="ml-0.5 text-[#027A48]">{signed(row.deltas?.reviews30 ?? row.reviews30)}</small></span>
                    <span>/</span>
                    <span>{row.reviews60}<small className="ml-0.5 text-[#027A48]">{signed(row.deltas?.reviews60 ?? row.reviews60)}</small></span>
                    <span>/</span>
                    <span>{row.reviews90}<small className="ml-0.5 text-[#027A48]">{signed(row.deltas?.reviews90 ?? row.reviews90)}</small></span>
                  </div>
                </td>
                <td className="px-3 py-3 tabular-nums text-[#344054]">{fmt(row.reviewsPerMonth, 1)}</td>
                <td className="px-3 py-3"><MomentumPill label={row.momentumLabel} /></td>
                <td className="px-3 py-3"><ResponseRing pct={row.responseRate} /></td>
                <td className="px-3 py-3 tabular-nums text-[#344054]">
                  {row.responseSpeedDaysAvg == null ? "—" : `${fmt(row.responseSpeedDaysAvg, 1)}d`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function GapWidgets({ data }: { data: CompetitorIntelligenceDashboardData }) {
  const you = data.leaderboardRows.find((row) => row.isYou);
  const chartRows = data.leaderboardRows.slice(0, 6).map((row) => ({
    name: row.isYou ? "You" : row.name,
    reviews: row.totalReviews,
    fill: row.isYou ? GREEN : BLUE,
  }));

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Card title="Review Gap Analysis" subtitle="Total review count by competitor.">
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartRows} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#667085" }} tickLine={false} axisLine={false} interval={0} />
              <YAxis tick={{ fontSize: 11, fill: "#667085" }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E6EAF0", fontSize: 12 }} />
              <Bar dataKey="reviews" radius={[8, 8, 0, 0]}>
                {chartRows.map((row) => <Cell key={row.name} fill={row.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Catch-Up Forecast" subtitle="Projected gap if current pace holds.">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.06em] text-[#98A2B3]">
              <tr>
                <th className="py-2 font-semibold">Competitor</th>
                <th className="py-2 font-semibold">3m</th>
                <th className="py-2 font-semibold">6m</th>
                <th className="py-2 font-semibold">ETA</th>
              </tr>
            </thead>
            <tbody>
              {data.gapRows.slice(0, 4).map((row) => (
                <tr key={row.competitorId} className="border-t border-[#F2F4F7]">
                  <td className="py-3 font-medium text-[#101828]">{row.competitorName}</td>
                  <td className="py-3 tabular-nums text-[#344054]">{fmt(row.pace3Months)}</td>
                  <td className="py-3 tabular-nums text-[#344054]">{fmt(row.pace6Months)}</td>
                  <td className="py-3 text-[#667085]">{row.estimatedCatchUp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Top Opportunities" subtitle="Where to close the gap fastest.">
        <div className="space-y-2">
          {(data.opportunities ?? data.positioningOpportunities.map((item) => item.title)).slice(0, 5).map((item) => (
            <div key={item} className="rounded-xl border border-[#E6EAF0] bg-[#F9FAFB] p-3 text-sm text-[#344054]">
              {item}
            </div>
          ))}
          {you ? (
            <div className="rounded-xl bg-[#ECFDF3] p-3 text-sm text-[#027A48]">
              You are adding {fmt(you.reviews30)} reviews/month. Increase review requests to improve catch-up pace.
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

function StrengthsTab({ data }: { data: CompetitorIntelligenceDashboardData }) {
  const groups = [
    ["Your strengths", data.strengths.positive, "green"],
    ["Your weaknesses", data.strengths.negative, "red"],
    ["Competitor strengths", data.strengths.competitorPositive, "blue"],
    ["Competitor weaknesses", data.strengths.competitorNegative, "amber"],
  ] as const;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {groups.map(([title, items, tone]) => (
        <Card key={title} title={title}>
          <div className="space-y-2">
            {items.length === 0 ? (
              <p className="text-sm text-[#667085]">No review themes found yet.</p>
            ) : (
              items.map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-lg bg-[#F9FAFB] px-3 py-2 text-sm">
                  <span className="font-medium text-[#344054]">{item.label}</span>
                  <RepBadge tone={tone}>{item.count}</RepBadge>
                </div>
              ))
            )}
          </div>
        </Card>
      ))}
      <Card title="Service Gaps" subtitle="Competitor praise themes that appear less often in your reviews." className="lg:col-span-2">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#F9FAFB] text-[11px] uppercase tracking-[0.06em] text-[#98A2B3]">
              <tr>
                <th className="px-3 py-2 font-semibold">Theme</th>
                <th className="px-3 py-2 font-semibold">Competitors</th>
                <th className="px-3 py-2 font-semibold">You</th>
                <th className="px-3 py-2 font-semibold">Gap</th>
              </tr>
            </thead>
            <tbody>
              {data.strengths.serviceGaps.map((row) => (
                <tr key={row.label} className="border-b border-[#F2F4F7]">
                  <td className="px-3 py-3 font-medium text-[#101828]">{row.label}</td>
                  <td className="px-3 py-3 tabular-nums text-[#344054]">{row.competitorMentions}</td>
                  <td className="px-3 py-3 tabular-nums text-[#344054]">{row.yourMentions}</td>
                  <td className="px-3 py-3 font-semibold tabular-nums text-[#B42318]">+{row.gap}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function ContentTab({ data }: { data: CompetitorIntelligenceDashboardData }) {
  const rows = [
    { name: "You", ...data.contentComparison.you },
    { name: "Competitors", ...data.contentComparison.competitors },
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card title="Review Content Comparison" subtitle="Depth and specificity of review text.">
        <div className="h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#667085" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#667085" }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E6EAF0", fontSize: 12 }} />
              <Bar dataKey="avgLength" name="Avg length" fill={GREEN} radius={[8, 8, 0, 0]} />
              <Bar dataKey="pctWithText" name="% with text" fill={BLUE} radius={[8, 8, 0, 0]} />
              <Bar dataKey="pctDetailed" name="% detailed" fill="#7C3AED" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card title="Content Signals">
        <dl className="space-y-3 text-sm">
          {[
            ["Your avg length", `${data.contentComparison.you.avgLength} chars`],
            ["Competitor avg length", `${data.contentComparison.competitors.avgLength} chars`],
            ["Your detailed reviews", `${data.contentComparison.you.pctDetailed}%`],
            ["Competitor detailed reviews", `${data.contentComparison.competitors.pctDetailed}%`],
            ["Your generic reviews", `${data.contentComparison.you.pctGeneric}%`],
            ["Competitor generic reviews", `${data.contentComparison.competitors.pctGeneric}%`],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-3">
              <dt className="text-[#667085]">{label}</dt>
              <dd className="font-semibold text-[#101828]">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}

export function CompetitorIntelligenceDashboard({
  businessId,
  data,
}: {
  businessId: string;
  data: CompetitorIntelligenceDashboardData;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("leaderboard");

  const sortedRows = useMemo(
    () => [...data.leaderboardRows].sort((a, b) => b.totalReviews - a.totalReviews),
    [data.leaderboardRows]
  );
  const you = sortedRows.find((row) => row.isYou) ?? sortedRows[0];
  const youRank = you ? sortedRows.findIndex((row) => row.id === you.id) + 1 : null;
  const topCompetitor = sortedRows.find((row) => !row.isYou);
  const primaryGap = data.gapRows
    .filter((row) => row.totalGap > 0)
    .sort((a, b) => b.totalGap - a.totalGap)[0];
  const velocityGap = you && topCompetitor ? you.reviews30 - topCompetitor.reviews30 : 0;
  const requiredMonthlyPace =
    topCompetitor && primaryGap
      ? Math.max(topCompetitor.reviews30 + 1, you?.reviews30 ?? 0)
      : you?.reviews30 ?? 0;

  return (
    <div className={rep.page}>
      <RepPageHeader
        title="Competitor Intelligence"
        subtitle={`Review position, gap, and content quality compared with nearby competitors for ${data.businessName}.`}
        dateRangeLabel={data.dateRangeLabel ?? "Last 90 days"}
        showCompare
        filterLabel="Filters"
      />

      <RepTabs tabs={tabs} active={activeTab} onChange={(tab) => setActiveTab(tab as TabId)} />

      {activeTab === "leaderboard" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <RepMetricCard label="You Rank" value={youRank ? `#${youRank}` : "—"} hint={`of ${sortedRows.length} businesses`} icon={Trophy} />
            <RepMetricCard label="Top Competitor 30d" value={fmt(topCompetitor?.reviews30)} hint={topCompetitor?.name ?? "No competitor"} icon={Users} />
            <RepMetricCard label="Review Gap" value={fmt(primaryGap?.totalGap ?? 0)} hint={primaryGap?.competitorName ?? "No gap"} />
            <RepMetricCard
              label="Velocity Gap"
              value={signed(velocityGap)}
              hint="you vs top competitor"
              trendPositive={velocityGap >= 0}
              valueClassName={velocityGap < 0 ? "text-[#B42318]" : "text-[#027A48]"}
              icon={velocityGap < 0 ? ArrowDownRight : ArrowUpRight}
              iconClassName={velocityGap < 0 ? "bg-[#FEF3F2] text-[#B42318]" : undefined}
            />
            <RepMetricCard label="Est Months to Catch Up" value={primaryGap?.estimatedCatchUpMonths == null ? "—" : fmt(primaryGap.estimatedCatchUpMonths)} hint={primaryGap?.estimatedCatchUp ?? "At current pace"} />
            <RepMetricCard label="Required Monthly Pace" value={fmt(requiredMonthlyPace)} hint="reviews / month" />
          </div>
          <LeaderboardTable rows={sortedRows} businessId={businessId} />
          <GapWidgets data={{ ...data, leaderboardRows: sortedRows }} />
        </>
      ) : null}

      {activeTab === "gap" ? (
        <div className="space-y-4">
          <GapWidgets data={{ ...data, leaderboardRows: sortedRows }} />
          <Card title="Review Gap Details">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#F9FAFB] text-[11px] uppercase tracking-[0.06em] text-[#98A2B3]">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Competitor</th>
                    <th className="px-3 py-2 font-semibold">Total Gap</th>
                    <th className="px-3 py-2 font-semibold">Velocity Gap</th>
                    <th className="px-3 py-2 font-semibold">Needed</th>
                    <th className="px-3 py-2 font-semibold">Catch-up</th>
                    <th className="px-3 py-2 font-semibold">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {data.gapRows.map((row) => (
                    <tr key={row.competitorId} className="border-b border-[#F2F4F7]">
                      <td className="px-3 py-3 font-medium text-[#101828]">{row.competitorName}</td>
                      <td className="px-3 py-3 tabular-nums text-[#344054]">{fmt(row.totalGap)}</td>
                      <td className="px-3 py-3 tabular-nums text-[#344054]">{fmt(row.monthlyVelocityGap)}</td>
                      <td className="px-3 py-3 tabular-nums text-[#344054]">{fmt(row.neededToCatch)}</td>
                      <td className="px-3 py-3 text-[#667085]">{row.estimatedCatchUp}</td>
                      <td className="px-3 py-3">
                        <RepBadge tone={row.gapExpanding ? "red" : "green"}>
                          {row.gapExpanding ? "Expanding" : "Closing"}
                        </RepBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : null}

      {activeTab === "strengths" ? <StrengthsTab data={data} /> : null}
      {activeTab === "content" ? <ContentTab data={data} /> : null}
      {activeTab === "platforms" ? (
        <Card title="Platform Presence" subtitle="Structured placeholder for non-Google review source coverage.">
          <div className="grid gap-3 md:grid-cols-3">
            {["Google", "Facebook", "Yelp"].map((platform) => (
              <div key={platform} className="rounded-xl border border-[#E6EAF0] bg-[#F9FAFB] p-4">
                <p className="font-semibold text-[#101828]">{platform}</p>
                <p className="mt-1 text-sm text-[#667085]">
                  {platform === "Google" ? "Connected through review feed data." : "Coming soon"}
                </p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
