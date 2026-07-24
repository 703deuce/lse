"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChevronRight, Trophy, Users } from "lucide-react";
import {
  ModuleHeader,
  ModulePage,
  TabBar,
  cardClass,
  moduleStack,
} from "@/components/ui/design-system";
import { cn } from "@/lib/utils";
import type { CompetitorIntelligenceData } from "@/lib/reviews/competitor-intelligence-data";

type TabId = "leaderboard" | "gap" | "strengths" | "opportunities" | "content";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "leaderboard", label: "Leaderboard" },
  { id: "gap", label: "Review Gap" },
  { id: "strengths", label: "Strengths and Weaknesses" },
  { id: "opportunities", label: "Opportunities" },
  { id: "content", label: "Content Comparison" },
];

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn(cardClass, "p-4", className)}>{children}</div>;
}

function MomentumBadge({ label }: { label: string }) {
  const warm = /slowing|dormant/i.test(label);
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", warm ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-[#137752]")}>
      {label}
    </span>
  );
}

function fmt(value: number | null | undefined, digits = 0) {
  if (value == null || Number.isNaN(value)) return "—";
  return digits > 0 ? value.toFixed(digits) : String(value);
}

function ThemeList({
  title,
  items,
  tone,
}: {
  title: string;
  items: Array<{ label: string; count: number }>;
  tone: "positive" | "negative";
}) {
  return (
    <Card>
      <h2 className="text-[14px] font-semibold text-zinc-900">{title}</h2>
      <ul className="mt-3 space-y-2.5">
        {items.length === 0 ? (
          <li className="text-[13px] text-zinc-500">No matching review themes yet.</li>
        ) : (
          items.map((item) => (
            <li key={item.label} className="flex items-center justify-between gap-3 text-[13px]">
              <span className="font-medium text-zinc-700">{item.label}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", tone === "positive" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700")}>
                {item.count}
              </span>
            </li>
          ))
        )}
      </ul>
    </Card>
  );
}

function MentionList({
  title,
  items,
}: {
  title: string;
  items: Array<{ term: string; count: number }>;
}) {
  return (
    <Card>
      <h2 className="text-[14px] font-semibold text-zinc-900">{title}</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.length === 0 ? (
          <p className="text-[13px] text-zinc-500">No matching mentions found yet.</p>
        ) : (
          items.map((item) => (
            <span
              key={item.term}
              className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1 text-[12px] font-medium capitalize text-zinc-700"
            >
              {item.term}
              <span className="text-zinc-400">{item.count}</span>
            </span>
          ))
        )}
      </div>
    </Card>
  );
}

export function CompetitorIntelligenceDashboard({
  businessId,
  data,
}: {
  businessId: string;
  data: CompetitorIntelligenceData;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("leaderboard");
  const contentChart = [
    {
      name: "You",
      avgLength: data.contentComparison.you.avgLength,
      pctWithText: data.contentComparison.you.pctWithText,
      pctGeneric: data.contentComparison.you.pctGeneric,
      pctDetailed: data.contentComparison.you.pctDetailed,
    },
    {
      name: "Competitors",
      avgLength: data.contentComparison.competitors.avgLength,
      pctWithText: data.contentComparison.competitors.pctWithText,
      pctGeneric: data.contentComparison.competitors.pctGeneric,
      pctDetailed: data.contentComparison.competitors.pctDetailed,
    },
  ];

  return (
    <ModulePage className={moduleStack}>
      <ModuleHeader
        title="Competitor Intelligence"
        subtitle={`Review position, gap, and content quality compared with nearby competitors for ${data.businessName}.`}
        icon={Users}
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

      <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {activeTab === "leaderboard" ? (
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-[#137752]" />
            <h2 className="text-[14px] font-semibold text-zinc-900">Review leaderboard</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-zinc-100 text-[11px] uppercase tracking-[0.06em] text-zinc-400">
                  <th className="px-3 py-2">Business</th>
                  <th className="px-3 py-2">Total</th>
                  <th className="px-3 py-2">Rating</th>
                  <th className="px-3 py-2">30 / 60 / 90</th>
                  <th className="px-3 py-2">Reviews/mo</th>
                  <th className="px-3 py-2">Momentum</th>
                  <th className="px-3 py-2">Response</th>
                </tr>
              </thead>
              <tbody>
                {data.leaderboardRows.map((row) => (
                  <tr key={row.id} className={cn("border-b border-zinc-50", row.isYou && "bg-emerald-50/40")}>
                    <td className="px-3 py-2 font-semibold text-zinc-900">{row.isYou ? "You" : row.name}</td>
                    <td className="px-3 py-2 tabular-nums text-zinc-700">{row.totalReviews}</td>
                    <td className="px-3 py-2 tabular-nums text-zinc-700">{fmt(row.rating, 1)}</td>
                    <td className="px-3 py-2 tabular-nums text-zinc-700">{row.reviews30} / {row.reviews60} / {row.reviews90}</td>
                    <td className="px-3 py-2 tabular-nums text-zinc-700">{fmt(row.reviewsPerMonth, 1)}</td>
                    <td className="px-3 py-2"><MomentumBadge label={row.momentumLabel} /></td>
                    <td className="px-3 py-2 tabular-nums text-zinc-700">
                      {row.responseRate}% · {row.responseSpeedDaysAvg == null ? "—" : `${row.responseSpeedDaysAvg}d`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {activeTab === "gap" ? (
        <div className="grid gap-2 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <h2 className="text-[14px] font-semibold text-zinc-900">Gap and catch-up model</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-zinc-100 text-[11px] uppercase tracking-[0.06em] text-zinc-400">
                    <th className="px-3 py-2">Competitor</th>
                    <th className="px-3 py-2">Total gap</th>
                    <th className="px-3 py-2">Velocity gap</th>
                    <th className="px-3 py-2">Needed</th>
                    <th className="px-3 py-2">Catch-up</th>
                    <th className="px-3 py-2">ETA</th>
                    <th className="px-3 py-2">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {data.gapRows.map((row) => (
                    <tr key={row.competitorId} className="border-b border-zinc-50">
                      <td className="px-3 py-2 font-medium text-zinc-900">{row.competitorName}</td>
                      <td className="px-3 py-2 tabular-nums text-zinc-700">{row.totalGap}</td>
                      <td className="px-3 py-2 tabular-nums text-zinc-700">{row.monthlyVelocityGap}</td>
                      <td className="px-3 py-2 tabular-nums text-zinc-700">{row.neededToCatch}</td>
                      <td className="px-3 py-2 text-zinc-700">
                        {row.estimatedCatchUpMonths == null ? row.estimatedCatchUp : `${row.estimatedCatchUpMonths} mo`}
                      </td>
                      <td className="px-3 py-2 text-zinc-700">{row.estimatedCatchUpDate ?? "—"}</td>
                      <td className="px-3 py-2">
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", row.gapExpanding ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700")}>
                          {row.gapExpanding ? "Expanding" : "Closing"}
                        </span>
                        {row.warning ? <p className="mt-1 max-w-xs text-[11px] leading-snug text-red-600">{row.warning}</p> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Card>
            <h2 className="text-[14px] font-semibold text-zinc-900">Projected total gap</h2>
            <div className="mt-3 space-y-3">
              {data.gapRows.slice(0, 4).map((row) => (
                <div key={row.competitorId} className="rounded-xl bg-zinc-50 p-3 text-[13px]">
                  <p className="font-semibold text-zinc-900">{row.competitorName}</p>
                  <p className="mt-1 text-zinc-500">3m: {row.pace3Months} · 6m: {row.pace6Months} · 12m: {row.pace12Months}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : null}

      {activeTab === "strengths" ? (
        <div className="grid gap-2 lg:grid-cols-2">
          <ThemeList title="Your positive themes" items={data.strengths.positive} tone="positive" />
          <ThemeList title="Your negative themes" items={data.strengths.negative} tone="negative" />
          <ThemeList title="Competitor positive themes" items={data.strengths.competitorPositive} tone="positive" />
          <ThemeList title="Competitor negative themes" items={data.strengths.competitorNegative} tone="negative" />
          <Card className="lg:col-span-2">
            <h2 className="text-[14px] font-semibold text-zinc-900">Service gaps</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-zinc-100 text-[11px] uppercase tracking-[0.06em] text-zinc-400">
                    <th className="px-3 py-2">Theme</th>
                    <th className="px-3 py-2">Competitor positive</th>
                    <th className="px-3 py-2">Your positive</th>
                    <th className="px-3 py-2">Gap</th>
                  </tr>
                </thead>
                <tbody>
                  {data.strengths.serviceGaps.length === 0 ? (
                    <tr>
                      <td className="px-3 py-6 text-zinc-500" colSpan={4}>No positive competitor service gaps found yet.</td>
                    </tr>
                  ) : (
                    data.strengths.serviceGaps.map((row) => (
                      <tr key={row.label} className="border-b border-zinc-50">
                        <td className="px-3 py-2 font-medium text-zinc-900">{row.label}</td>
                        <td className="px-3 py-2 tabular-nums text-zinc-700">{row.competitorMentions}</td>
                        <td className="px-3 py-2 tabular-nums text-zinc-700">{row.yourMentions}</td>
                        <td className="px-3 py-2 tabular-nums font-semibold text-red-600">+{row.gap}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
          <MentionList title="Frequently praised services" items={data.strengths.frequentlyPraisedServices} />
          <MentionList title="Frequently mentioned employees" items={data.strengths.frequentlyMentionedEmployees} />
        </div>
      ) : null}

      {activeTab === "opportunities" ? (
        <div className="grid gap-2 lg:grid-cols-2">
          <Card>
            <h2 className="text-[14px] font-semibold text-zinc-900">Competitor complaint patterns</h2>
            <ul className="mt-3 space-y-2.5">
              {data.complaintPatterns.length === 0 ? (
                <li className="text-[13px] text-zinc-500">No competitor negative theme gaps found yet.</li>
              ) : (
                data.complaintPatterns.map((pattern) => (
                  <li key={pattern.theme} className="rounded-xl bg-zinc-50 p-3 text-[13px]">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-zinc-900">{pattern.theme}</span>
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                        Gap {pattern.gap}
                      </span>
                    </div>
                    <p className="mt-1 text-zinc-500">
                      Competitors: {pattern.competitorMentions} · You: {pattern.yourMentions}
                    </p>
                  </li>
                ))
              )}
            </ul>
          </Card>
          <Card>
            <h2 className="text-[14px] font-semibold text-zinc-900">Positioning opportunities</h2>
            <div className="mt-3 space-y-3">
              {data.positioningOpportunities.length === 0 ? (
                <p className="text-[13px] text-zinc-500">Opportunities will appear as competitor complaints build a theme baseline.</p>
              ) : (
                data.positioningOpportunities.map((opportunity) => (
                  <div key={opportunity.title} className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 text-[13px]">
                    <p className="font-semibold text-zinc-900">{opportunity.title}</p>
                    <p className="mt-1 leading-relaxed text-zinc-600">{opportunity.description}</p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      ) : null}

      {activeTab === "content" ? (
        <div className="grid gap-2 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <h2 className="text-[14px] font-semibold text-zinc-900">Review content comparison</h2>
            <div className="mt-3 h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={contentChart} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke="#F4F4F5" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#71717A" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#71717A" }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E4E4E7", fontSize: 12 }} />
                  <Bar dataKey="avgLength" name="Avg length" fill="#137752" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="pctWithText" name="% with text" fill="#3B82F6" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="pctGeneric" name="% generic" fill="#F59E0B" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="pctDetailed" name="% detailed" fill="#8B5CF6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card>
            <h2 className="text-[14px] font-semibold text-zinc-900">Content quality</h2>
            <div className="mt-4 space-y-3 text-[13px]">
              <div className="flex justify-between gap-2">
                <span className="text-zinc-500">Your avg length</span>
                <span className="font-semibold text-zinc-900">{data.contentComparison.you.avgLength} chars</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-zinc-500">Competitor avg length</span>
                <span className="font-semibold text-zinc-900">{data.contentComparison.competitors.avgLength} chars</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-zinc-500">Your written reviews</span>
                <span className="font-semibold text-zinc-900">{data.contentComparison.you.pctWithText}%</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-zinc-500">Competitor written reviews</span>
                <span className="font-semibold text-zinc-900">{data.contentComparison.competitors.pctWithText}%</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-zinc-500">Your generic / detailed</span>
                <span className="font-semibold text-zinc-900">
                  {data.contentComparison.you.pctGeneric}% / {data.contentComparison.you.pctDetailed}%
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-zinc-500">Competitor generic / detailed</span>
                <span className="font-semibold text-zinc-900">
                  {data.contentComparison.competitors.pctGeneric}% / {data.contentComparison.competitors.pctDetailed}%
                </span>
              </div>
            </div>
          </Card>
          <Card className="xl:col-span-3">
            <h2 className="text-[14px] font-semibold text-zinc-900">Content signal counts</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-zinc-100 text-[11px] uppercase tracking-[0.06em] text-zinc-400">
                    <th className="px-3 py-2">Group</th>
                    <th className="px-3 py-2">Location terms</th>
                    <th className="px-3 py-2">Service terms</th>
                    <th className="px-3 py-2">Employee mentions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-zinc-50">
                    <td className="px-3 py-2 font-semibold text-zinc-900">You</td>
                    <td className="px-3 py-2 tabular-nums text-zinc-700">{data.contentComparison.you.locationTerms}</td>
                    <td className="px-3 py-2 tabular-nums text-zinc-700">{data.contentComparison.you.serviceTerms}</td>
                    <td className="px-3 py-2 tabular-nums text-zinc-700">{data.contentComparison.you.employeeMentions}</td>
                  </tr>
                  <tr className="border-b border-zinc-50">
                    <td className="px-3 py-2 font-semibold text-zinc-900">Competitors</td>
                    <td className="px-3 py-2 tabular-nums text-zinc-700">{data.contentComparison.competitors.locationTerms}</td>
                    <td className="px-3 py-2 tabular-nums text-zinc-700">{data.contentComparison.competitors.serviceTerms}</td>
                    <td className="px-3 py-2 tabular-nums text-zinc-700">{data.contentComparison.competitors.employeeMentions}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : null}
    </ModulePage>
  );
}
