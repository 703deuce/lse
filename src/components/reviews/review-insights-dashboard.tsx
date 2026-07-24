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
import { ChevronRight, MessageSquareText, Search, Sparkles } from "lucide-react";
import {
  ModuleHeader,
  ModulePage,
  TabBar,
  cardClass,
  moduleStack,
} from "@/components/ui/design-system";
import { cn } from "@/lib/utils";
import type { ReviewInsightsData, ReviewInsightTheme } from "@/lib/reviews/review-insights-data";

type TabId = "themes" | "keywords" | "performance" | "quality";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "themes", label: "Themes" },
  { id: "keywords", label: "Services and Keywords" },
  { id: "performance", label: "Response Performance" },
  { id: "quality", label: "Response Quality" },
];

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn(cardClass, "p-4", className)}>{children}</div>;
}

function ThemePanel({
  title,
  items,
  tone,
}: {
  title: string;
  items: ReviewInsightTheme[];
  tone: "positive" | "negative" | "emerging";
}) {
  const styles = {
    positive: "bg-emerald-50 text-emerald-700",
    negative: "bg-red-50 text-red-700",
    emerging: "bg-blue-50 text-blue-700",
  };
  return (
    <Card>
      <h2 className="text-[14px] font-semibold text-zinc-900">{title}</h2>
      <ul className="mt-3 space-y-2.5">
        {items.length === 0 ? (
          <li className="text-[13px] text-zinc-500">No matching themes yet.</li>
        ) : (
          items.map((item) => (
            <li key={item.label} className="flex items-center justify-between gap-3 text-[13px]">
              <span className="font-medium text-zinc-700">{item.label}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", styles[tone])}>
                {item.count} · {item.pct}%
              </span>
            </li>
          ))
        )}
      </ul>
    </Card>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">{label}</p>
      <p className="mt-1.5 text-2xl font-bold tabular-nums text-zinc-900">{value}</p>
      {sub ? <p className="mt-1 text-[12px] text-zinc-500">{sub}</p> : null}
    </Card>
  );
}

export function ReviewInsightsDashboard({
  businessId,
  data,
}: {
  businessId: string;
  data: ReviewInsightsData;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("themes");
  const responseBars = [
    { label: "Answered", count: data.responsePerformance.answered },
    { label: "Unanswered +", count: data.responsePerformance.unansweredPositive },
    { label: "Unanswered -", count: data.responsePerformance.unansweredNegative },
    { label: "Neutral", count: data.responsePerformance.unansweredNeutral },
  ];

  return (
    <ModulePage className={moduleStack}>
      <ModuleHeader
        title="Review Insights"
        subtitle={`Themes, service mentions, and response quality signals for ${data.businessName}.`}
        icon={Sparkles}
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

      {activeTab === "themes" ? (
        <div className="grid gap-2 lg:grid-cols-3">
          <ThemePanel title="Positive themes" items={data.themes.positive} tone="positive" />
          <ThemePanel title="Negative themes" items={data.themes.negative} tone="negative" />
          <ThemePanel title="Emerging themes" items={data.themes.emerging} tone="emerging" />
        </div>
      ) : null}

      {activeTab === "keywords" ? (
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Search className="h-4 w-4 text-[#137752]" />
            <h2 className="text-[14px] font-semibold text-zinc-900">Services and keyword mentions</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.servicesAndKeywords.length === 0 ? (
              <p className="text-[13px] text-zinc-500">No written review keywords found yet.</p>
            ) : (
              data.servicesAndKeywords.map((item) => (
                <span
                  key={item.keyword}
                  className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1 text-[12px] font-medium capitalize text-zinc-700"
                >
                  {item.keyword}
                  <span className="text-zinc-400">{item.count}</span>
                </span>
              ))
            )}
          </div>
        </Card>
      ) : null}

      {activeTab === "performance" ? (
        <div className="grid gap-2 xl:grid-cols-4">
          <Stat label="Response rate" value={`${data.responsePerformance.responseRate}%`} sub={`${data.responsePerformance.answered} of ${data.responsePerformance.totalWithText} written reviews`} />
          <Stat label="Avg response time" value={data.responsePerformance.avgResponseTimeDays == null ? "—" : `${data.responsePerformance.avgResponseTimeDays}d`} sub="Uses exact timestamps when available" />
          <Stat label="Unanswered negative" value={String(data.responsePerformance.unansweredNegative)} sub="Prioritize these first" />
          <Stat label="Unanswered positive" value={String(data.responsePerformance.unansweredPositive)} sub="Good candidates for quick replies" />
          <Card className="xl:col-span-4">
            <h2 className="text-[14px] font-semibold text-zinc-900">Response coverage</h2>
            <div className="mt-3 h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={responseBars} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke="#F4F4F5" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#71717A" }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#71717A" }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E4E4E7", fontSize: 12 }} />
                  <Bar dataKey="count" fill="#137752" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      ) : null}

      {activeTab === "quality" ? (
        <div className="grid gap-2 lg:grid-cols-3">
          <Card className="border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-white lg:col-span-2">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-[#137752]">
                <MessageSquareText className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-emerald-700">Response quality</p>
                <h2 className="mt-1 text-xl font-bold text-zinc-900">
                  {data.responseQuality.genericResponseSuspected} generic replies suspected
                </h2>
                <p className="mt-2 text-[13px] leading-relaxed text-zinc-700">
                  Generic replies are detected from short repeated phrases like thank-you-only responses. Use specifics from the customer review to improve trust.
                </p>
              </div>
            </div>
          </Card>
          <Stat label="Generic response rate" value={`${data.responseQuality.genericResponsePct}%`} sub="Of answered written reviews" />
        </div>
      ) : null}
    </ModulePage>
  );
}
