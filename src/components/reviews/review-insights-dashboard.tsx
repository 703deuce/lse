"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  Camera,
  FileText,
  MessageSquareText,
  Search,
  Sparkles,
  UserRoundCheck,
} from "lucide-react";
import {
  ModulePage,
  moduleStack,
} from "@/components/ui/design-system";
import {
  REP_GREEN,
  RepBadge,
  RepMetricCard,
  RepPageHeader,
  RepTabs,
  rep,
} from "@/components/reputation/rep-ui";
import { cn } from "@/lib/utils";
import type { ReviewInsightsData, ReviewInsightTheme } from "@/lib/reviews/review-insights-data";

type TabId = "themes" | "keywords" | "performance" | "quality";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "themes", label: "Themes" },
  { id: "keywords", label: "Services & Keywords" },
  { id: "performance", label: "Response Performance" },
  { id: "quality", label: "Response Quality" },
];

function formatNum(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "--";
  return value.toLocaleString();
}

function Card({
  title,
  description,
  children,
  className,
  action,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <section className={cn(rep.card, "overflow-hidden", className)}>
      <div className="flex items-start justify-between gap-3 border-b border-[#E6EAF0] px-4 py-3">
        <div>
          <h2 className="text-[15px] font-semibold text-[#101828]">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-[#667085]">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function ThemePanel({
  title,
  items,
  tone,
}: {
  title: string;
  items: ReviewInsightTheme[];
  tone: "positive" | "negative";
}) {
  const max = Math.max(...items.map((item) => item.count), 1);
  const bar = tone === "positive" ? "bg-[#137752]" : "bg-[#D92D20]";
  const text = tone === "positive" ? "text-[#137752]" : "text-[#B42318]";

  return (
    <Card title={title}>
      <ul className="space-y-3">
        {items.length === 0 ? (
          <li className="py-8 text-center text-sm text-[#667085]">No matching themes yet.</li>
        ) : (
          items.map((item) => (
            <li key={item.label}>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <span className="truncate text-sm font-semibold text-[#344054]">{item.label}</span>
                <span className={cn("text-xs font-bold tabular-nums", text)}>
                  {item.count} ({item.pct}%)
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-[#F2F4F7]">
                <div
                  className={cn("h-full rounded-full", bar)}
                  style={{ width: `${Math.max(8, (item.count / max) * 100)}%` }}
                />
              </div>
            </li>
          ))
        )}
      </ul>
    </Card>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <RepMetricCard label={label} value={value} hint={sub} />;
}

function KeywordPanel({
  title,
  items,
}: {
  title: string;
  items: Array<{ keyword: string; count: number }>;
}) {
  return (
    <Card title={title}>
      <div className="flex flex-wrap gap-2">
        {items.length === 0 ? (
          <p className="py-4 text-sm text-[#667085]">No mentions found yet.</p>
        ) : (
          items.map((item) => (
            <span
              key={item.keyword}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#E6EAF0] bg-[#F9FAFB] px-3 py-1 text-xs font-semibold capitalize text-[#344054]"
            >
              {item.keyword}
              <span className="text-[#98A2B3]">{item.count}</span>
            </span>
          ))
        )}
      </div>
    </Card>
  );
}

function MentionList({
  items,
  empty,
}: {
  items: Array<{ keyword: string; count: number }>;
  empty: string;
}) {
  const max = Math.max(...items.map((item) => item.count), 1);

  if (!items.length) {
    return <p className="py-8 text-center text-sm text-[#667085]">{empty}</p>;
  }

  return (
    <ul className="space-y-3">
      {items.slice(0, 8).map((item) => (
        <li key={item.keyword}>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <span className="truncate text-sm font-semibold capitalize text-[#344054]">{item.keyword}</span>
            <span className="text-xs font-bold tabular-nums text-[#101828]">{item.count}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#F2F4F7]">
            <div
              className="h-full rounded-full bg-[#137752]"
              style={{ width: `${Math.max(8, (item.count / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function BoolBadge({ value }: { value: boolean }) {
  return <RepBadge tone={value ? "green" : "gray"}>{value ? "Yes" : "No"}</RepBadge>;
}

export function ReviewInsightsDashboard({
  businessId,
  data,
}: {
  businessId: string;
  data: ReviewInsightsData;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("themes");
  void businessId;

  const trendRows = data.themes.themeFrequencyOverTime.map((theme) => ({
    label: theme.label,
    "Recent 30d": theme.recent30,
    "Prior 30d": theme.prior30,
  }));
  const responseBars = [
    { label: "Answered", count: data.responsePerformance.answered },
    { label: "Unanswered +", count: data.responsePerformance.unansweredPositive },
    { label: "Unanswered -", count: data.responsePerformance.unansweredNegative },
    { label: "Neutral", count: data.responsePerformance.unansweredNeutral },
  ];

  return (
    <ModulePage className={moduleStack}>
      <RepPageHeader
        title="Review Insights"
        subtitle="Discover what customers are saying and how you're responding."
        dateRangeLabel="Last 90 days"
        showCompare
      />

      <RepTabs tabs={TABS} active={activeTab} onChange={(id) => setActiveTab(id as TabId)} />

      {activeTab === "themes" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <RepMetricCard
              label="Positive Themes"
              value={formatNum(data.metrics.positiveThemeMentions)}
              hint="Top positive mentions"
              icon={Sparkles}
            />
            <RepMetricCard
              label="Negative Themes"
              value={formatNum(data.metrics.negativeThemeMentions)}
              hint="Top negative mentions"
              icon={AlertTriangle}
              iconClassName="bg-[#FEF3F2] text-[#D92D20]"
            />
            <RepMetricCard
              label="Total Review Text"
              value={formatNum(data.metrics.totalReviewText)}
              hint="Written reviews analyzed"
              icon={FileText}
            />
            <RepMetricCard
              label="Avg Review Length"
              value={data.metrics.avgReviewLength == null ? "--" : `${data.metrics.avgReviewLength}`}
              hint="Characters per review"
              icon={MessageSquareText}
            />
            <RepMetricCard
              label="Reviews with Photos"
              value={data.metrics.reviewsWithPhotos == null ? "--" : formatNum(data.metrics.reviewsWithPhotos)}
              hint={data.metrics.reviewsWithPhotos == null ? "Photo data unavailable" : "Detected with media"}
              icon={Camera}
            />
            <RepMetricCard
              label="Employee Mentions"
              value={formatNum(data.metrics.employeeMentions)}
              hint="Names or crew mentions"
              icon={UserRoundCheck}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <ThemePanel title="Top Positive Themes" items={data.themes.positive} tone="positive" />
            <ThemePanel title="Top Negative Themes" items={data.themes.negative} tone="negative" />
            <Card title="Theme Trend 30d" description="Recent 30 days compared with the prior 30 days.">
              {trendRows.length ? (
                <div className="h-[248px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendRows} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                      <CartesianGrid stroke="#F2F4F7" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#98A2B3" }} tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#98A2B3" }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E6EAF0", fontSize: 12 }} />
                      <Line type="monotone" dataKey="Recent 30d" stroke={REP_GREEN} strokeWidth={2.5} dot={false} />
                      <Line type="monotone" dataKey="Prior 30d" stroke="#98A2B3" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="py-24 text-center text-sm text-[#667085]">No theme movement available yet.</p>
              )}
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card
              title="Theme Comparison vs Competitors"
              description="Uses competitor reviews from the latest Review Momentum run when available."
              className="xl:col-span-2"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#E6EAF0] text-[11px] uppercase tracking-[0.06em] text-[#98A2B3]">
                      <th className="px-3 py-2 font-semibold">Theme</th>
                      <th className="px-3 py-2 font-semibold">You</th>
                      <th className="px-3 py-2 font-semibold">Competitors</th>
                      <th className="px-3 py-2 font-semibold">Competitor Avg</th>
                      <th className="px-3 py-2 font-semibold">Avg Gap</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.themes.competitorThemes.length === 0 ? (
                      <tr>
                        <td className="px-3 py-8 text-[#667085]" colSpan={5}>
                          Run Review Momentum with competitors to compare competitor review themes.
                        </td>
                      </tr>
                    ) : (
                      data.themes.competitorThemes.map((theme) => (
                        <tr key={theme.label} className="border-b border-[#F2F4F7] last:border-0">
                          <td className="px-3 py-3 font-semibold text-[#101828]">{theme.label}</td>
                          <td className="px-3 py-3 tabular-nums text-[#344054]">{theme.yourCount}</td>
                          <td className="px-3 py-3 tabular-nums text-[#344054]">{theme.competitorCount}</td>
                          <td className="px-3 py-3 tabular-nums text-[#344054]">{theme.competitorAvg}</td>
                          <td className={cn("px-3 py-3 tabular-nums font-semibold", theme.gap > 0 ? "text-[#B42318]" : "text-[#027A48]")}>
                            {theme.gap > 0 ? "+" : ""}{theme.gap}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
            <div className="space-y-4">
              <Card title="Most Mentioned Services">
                <MentionList items={data.categorizedKeywords.services} empty="No service mentions found yet." />
              </Card>
              <Card title="Location Mentions">
                <MentionList items={data.categorizedKeywords.cities} empty="No location mentions found yet." />
              </Card>
            </div>
          </div>

          <div className="rounded-xl border border-[#D1FADF] bg-[#ECFDF3] px-4 py-3 text-xs leading-relaxed text-[#027A48]">
            AI-generated review themes are directional and should be validated against source reviews before making business decisions.
          </div>
        </div>
      ) : null}

      {activeTab === "keywords" ? (
        <div className="space-y-4">
          <Card
            title="Top Keyword Mentions"
            description="Uncategorized words and phrases found in recent written reviews."
            action={<Search className="h-4 w-4 text-[#137752]" />}
          >
            <div className="flex flex-wrap gap-2">
              {data.servicesAndKeywords.length === 0 ? (
                <p className="py-6 text-sm text-[#667085]">No written review keywords found yet.</p>
              ) : (
                data.servicesAndKeywords.map((item) => (
                  <span
                    key={item.keyword}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#E6EAF0] bg-white px-3 py-1.5 text-xs font-semibold capitalize text-[#344054]"
                  >
                    {item.keyword}
                    <span className="text-[#98A2B3]">{item.count}</span>
                  </span>
                ))
              )}
            </div>
          </Card>
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <KeywordPanel title="Services" items={data.categorizedKeywords.services} />
            <KeywordPanel title="Cities" items={data.categorizedKeywords.cities} />
            <KeywordPanel title="Employees" items={data.categorizedKeywords.employees} />
            <KeywordPanel title="Pricing" items={data.categorizedKeywords.pricing} />
            <KeywordPanel title="Speed" items={data.categorizedKeywords.speed} />
            <KeywordPanel title="Communication" items={data.categorizedKeywords.communication} />
          </div>
        </div>
      ) : null}

      {activeTab === "performance" ? (
        <div className="grid gap-4 xl:grid-cols-4">
          <Stat label="Response rate" value={`${data.responsePerformance.responseRate}%`} sub={`${data.responsePerformance.answered} of ${data.responsePerformance.totalWithText} written reviews`} />
          <Stat label="Avg response time" value={data.responsePerformance.avgResponseTimeDays == null ? "—" : `${data.responsePerformance.avgResponseTimeDays}d`} sub="Uses exact timestamps when available" />
          <Stat label="Unanswered negative" value={String(data.responsePerformance.unansweredNegative)} sub="Prioritize these first" />
          <Stat label="Unanswered positive" value={String(data.responsePerformance.unansweredPositive)} sub="Good candidates for quick replies" />
          <Stat label="Positive response rate" value={`${data.responsePerformance.positiveResponseRate}%`} sub="Among positive reviews in the window" />
          <Stat label="Negative response rate" value={`${data.responsePerformance.negativeResponseRate}%`} sub="Among negative reviews in the window" />
          <Stat
            label="Oldest unanswered"
            value={data.responsePerformance.oldestUnansweredDays == null ? "—" : `${data.responsePerformance.oldestUnansweredDays}d`}
            sub={data.responsePerformance.oldestUnansweredAt ?? "No unanswered reviews in window"}
          />
          <Card title="Response Coverage" description="Answered and unanswered written reviews by sentiment." className="xl:col-span-4">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={responseBars} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke="#F2F4F7" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#667085" }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#667085" }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E6EAF0", fontSize: 12 }} />
                  <Bar dataKey="count" fill={REP_GREEN} radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      ) : null}

      {activeTab === "quality" ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className={cn(rep.card, "border-[#D1FADF] bg-gradient-to-br from-[#ECFDF3]/80 to-white p-4 lg:col-span-2")}>
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D1FADF] text-[#137752]">
                <MessageSquareText className="h-5 w-5" />
              </span>
              <div>
                <p className={cn(rep.label, "text-[#137752]")}>Response Quality</p>
                <h2 className="mt-1 text-xl font-bold text-[#101828]">
                  {data.responseQuality.genericResponseSuspected} generic replies suspected
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[#344054]">
                  Quality heuristics check personalization, copy/paste clusters, defensive wording, issue addressing, and resolution offers.
                </p>
              </div>
            </div>
          </div>
          <Stat label="Generic response rate" value={`${data.responseQuality.genericResponsePct}%`} sub="Of answered written reviews" />
          <Stat label="Personalized" value={`${data.responseQuality.qualitySummary.personalizedPct}%`} sub="Mentions reviewer or review specifics" />
          <Stat label="Copy/paste" value={`${data.responseQuality.qualitySummary.copyPastePct}%`} sub="Repeated response clusters" />
          <Stat label="Addresses issue" value={`${data.responseQuality.qualitySummary.addressesIssuePct}%`} sub="For low-rating complaints" />
          <Stat label="Offers resolution" value={`${data.responseQuality.qualitySummary.offersResolutionPct}%`} sub="Refund, call, credit, resolve, etc." />
          <Stat label="Defensive replies" value={String(data.responseQuality.qualitySummary.defensiveCount)} sub="Phrases likely to escalate" />
          <Card title="Response Quality Rows" description="Review-level quality signals from owner responses." className="lg:col-span-3">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#E6EAF0] text-[11px] uppercase tracking-[0.06em] text-[#98A2B3]">
                    <th className="px-3 py-2">Review</th>
                    <th className="px-3 py-2">Personalized</th>
                    <th className="px-3 py-2">Generic</th>
                    <th className="px-3 py-2">Copy/paste</th>
                    <th className="px-3 py-2">Defensive</th>
                    <th className="px-3 py-2">Issue</th>
                    <th className="px-3 py-2">Resolution</th>
                    <th className="px-3 py-2">Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {data.responseQuality.rows.length === 0 ? (
                    <tr>
                      <td className="px-3 py-8 text-[#667085]" colSpan={8}>No owner responses found in the current window.</td>
                    </tr>
                  ) : (
                    data.responseQuality.rows.slice(0, 50).map((row, idx) => (
                      <tr key={row.reviewId ?? idx} className="border-b border-[#F2F4F7] last:border-0">
                        <td className="max-w-[12rem] truncate px-3 py-3 text-[#667085]">{row.reviewId ?? "—"}</td>
                        <td className="px-3 py-3"><BoolBadge value={row.personalized} /></td>
                        <td className="px-3 py-3"><BoolBadge value={row.generic} /></td>
                        <td className="px-3 py-3 text-[#344054]">{row.copyPasteClusterId ?? "—"}</td>
                        <td className="px-3 py-3"><BoolBadge value={row.defensive} /></td>
                        <td className="px-3 py-3"><BoolBadge value={row.addressesIssue} /></td>
                        <td className="px-3 py-3"><BoolBadge value={row.offersResolution} /></td>
                        <td className="max-w-sm px-3 py-3 text-[#667085]">{row.evidence.join("; ") || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : null}
    </ModulePage>
  );
}
