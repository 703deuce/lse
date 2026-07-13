"use client";

import type { LucideIcon } from "lucide-react";
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  MoreVertical,
  Plus,
  RefreshCw,
  Shield,
  Sparkles,
  Star,
  Tag,
  ThumbsUp,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { Sparkline } from "@/components/overview/overview-charts";
import {
  ModuleHeader,
  TabBar,
  btnPrimary,
  btnSecondary,
  cardClass,
  cardLabelClass,
} from "@/components/ui/design-system";
import { GridMetricCard } from "@/components/ui/metric-card";
import { cn } from "@/lib/utils";
import type { ReviewListItem, ReviewsPageData } from "@/lib/reviews/reviews-page-data";

export const REVIEWS_TABS = [
  { id: "overview", label: "Overview", icon: null },
  { id: "your-reviews", label: "Your Reviews", icon: Star },
  { id: "competitor-reviews", label: "Competitor Reviews", icon: null },
  { id: "sentiment", label: "Themes & Sentiment", icon: null },
  { id: "unanswered", label: "Unanswered", icon: null },
] as const;

export type ReviewsTabId = (typeof REVIEWS_TABS)[number]["id"];

export function RvCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn(cardClass, "p-4", className)}>{children}</div>;
}

export function RvSectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function kpiDeltaSub(
  value: number | null,
  suffix: string,
  invert = false
): { sub?: string; trendPositive?: boolean } {
  if (value == null || value === 0) {
    const trimmed = suffix.trim();
    return trimmed ? { sub: trimmed } : {};
  }
  const positive = invert ? value < 0 : value > 0;
  return {
    sub: `${positive ? "↑" : "↓"} ${Math.abs(value)}${suffix}`,
    trendPositive: positive,
  };
}

export function DeltaText({
  value,
  suffix = " vs prior 90 days",
  invert = false,
}: {
  value: number | null;
  suffix?: string;
  invert?: boolean;
}) {
  if (value == null || value === 0) {
    return <span className="text-xs text-zinc-500">{suffix.trim() || "—"}</span>;
  }
  const positive = invert ? value < 0 : value > 0;
  return (
    <span className={cn("text-xs font-medium", positive ? "text-emerald-600" : "text-red-600")}>
      {positive ? "↑" : "↓"} {Math.abs(value)}
      {suffix}
    </span>
  );
}

export function StarRating({ rating, size = "sm" }: { rating: number | null; size?: "sm" | "md" }) {
  const stars = rating ?? 0;
  const cls = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";
  return (
    <span className="inline-flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={cn(cls, i < Math.round(stars) ? "fill-emerald-500 text-emerald-500" : "text-zinc-200")} />
      ))}
    </span>
  );
}

export function ReviewStatusBadge({ replied, variant = "default" }: { replied: boolean; variant?: "default" | "pill" }) {
  if (replied) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-xs font-medium text-emerald-700",
          variant === "pill" && "rounded-full bg-emerald-50 px-2.5 py-0.5"
        )}
      >
        <CheckCircle2 className="h-3 w-3" />
        Replied
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium text-amber-700",
        variant === "pill" && "rounded-full bg-amber-50 px-2.5 py-0.5"
      )}
    >
      <Clock className="h-3 w-3" />
      {variant === "pill" ? "Unreplied" : "Unanswered"}
    </span>
  );
}

export function UrgencyBadge({ urgency }: { urgency: ReviewListItem["urgency"] }) {
  if (!urgency) return null;
  const styles = {
    urgent: "bg-red-50 text-red-700 ring-1 ring-red-100",
    high: "bg-orange-50 text-orange-700 ring-1 ring-orange-100",
    medium: "bg-amber-50 text-amber-700 ring-1 ring-amber-100",
    low: "bg-zinc-100 text-zinc-600",
  };
  const labels = { urgent: "Urgent", high: "High", medium: "Medium", low: "Low" };
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", styles[urgency])}>
      {labels[urgency]}
    </span>
  );
}

export function SourceIcon({ source }: { source: ReviewListItem["source"] }) {
  if (source === "facebook") {
    return <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">f</span>;
  }
  if (source === "yelp") {
    return <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">★</span>;
  }
  return <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-blue-600 ring-1 ring-zinc-200">G</span>;
}

export function ReviewerAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const cls = size === "sm" ? "h-8 w-8 text-[11px]" : "h-9 w-9 text-xs";
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-full bg-zinc-100 font-semibold text-zinc-600", cls)}>
      {initials}
    </span>
  );
}

export function TagPills({ tags }: { tags: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {tags.slice(0, 2).map((tag) => (
        <span key={tag} className="rounded bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600">
          {tag}
        </span>
      ))}
      {tags.length > 2 && (
        <span className="rounded bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500">+{tags.length - 2}</span>
      )}
    </div>
  );
}

export function BusinessCell({ row }: { row: ReviewListItem }) {
  return (
    <div className="flex items-center gap-2">
      {row.isTarget ? (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50">
          <MapPin className="h-3.5 w-3.5 text-emerald-600" />
        </span>
      ) : (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100">
          <Building2 className="h-3.5 w-3.5 text-zinc-500" />
        </span>
      )}
      <span className="font-medium text-zinc-900">{row.isTarget ? "You" : row.businessName}</span>
    </div>
  );
}

export function ReviewsHeader({
  businessId,
  loading,
  onRefresh,
  onRunMomentum,
}: {
  businessId: string;
  loading?: boolean;
  onRefresh: () => void;
  onRunMomentum?: () => void;
}) {
  return (
    <ModuleHeader
      title="Reviews"
      subtitle="Monitor your review feed, compare competitors, and spot momentum over the last 90 days."
      actions={
        <>
          <button type="button" onClick={onRefresh} disabled={loading} className={btnSecondary}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </button>
          <Link href={`/businesses/${businessId}/review-requests`} className={btnSecondary}>
            <Mail className="h-4 w-4" />
            Request Reviews
          </Link>
          <button type="button" onClick={onRunMomentum} className={btnPrimary}>
            <Plus className="h-4 w-4" />
            Create Reply Tasks
          </button>
        </>
      }
    />
  );
}

export function ReviewsKpiRow({
  kpis,
  variant = "default",
}: {
  kpis: ReviewsPageData["kpis"];
  variant?: "default" | "unanswered";
}) {
  if (variant === "unanswered") {
    const cards = [
      {
        label: "UNANSWERED REVIEWS (90D)",
        value: kpis.unanswered90d ?? 0,
        icon: MessageSquare,
        iconWrapClassName: "bg-amber-50",
        iconClassName: "text-amber-600",
        ...kpiDeltaSub(kpis.newReviews90dDelta, " vs prior 90 days", true),
      },
      {
        label: "AVG. DAYS WAITING",
        value: kpis.avgDaysWaiting ?? "—",
        icon: Clock,
        iconWrapClassName: "bg-zinc-100",
        iconClassName: "text-zinc-600",
      },
      {
        label: "RESPONSE RATE (90D)",
        value: `${kpis.responseRate}%`,
        icon: CheckCircle2,
        iconWrapClassName: "bg-emerald-50",
        iconClassName: "text-emerald-600",
        ...kpiDeltaSub(kpis.responseRateDelta, "% vs prior 90 days"),
      },
      {
        label: "URGENT (SLA > 7 DAYS)",
        value: kpis.urgentCount ?? 0,
        icon: Shield,
        iconWrapClassName: "bg-red-50",
        iconClassName: "text-red-600",
      },
    ];
    return (
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <GridMetricCard key={c.label} variant="default" compact {...c} />
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: "AVERAGE RATING",
      value: `${kpis.avgRating?.toFixed(1) ?? "—"} ★`,
      icon: Star,
      iconWrapClassName: "bg-emerald-50",
      iconClassName: "text-emerald-600",
      variant: "primary" as const,
      ...kpiDeltaSub(kpis.avgRatingDelta, " vs prior 90 days"),
    },
    {
      label: "TOTAL REVIEWS",
      value: kpis.totalReviews,
      icon: MessageSquare,
      iconWrapClassName: "bg-sky-50",
      iconClassName: "text-sky-600",
      sub: "All time",
    },
    {
      label: "NEW REVIEWS (90D)",
      value: kpis.newReviews90d,
      icon: TrendingUp,
      iconWrapClassName: "bg-violet-50",
      iconClassName: "text-violet-600",
      ...kpiDeltaSub(kpis.newReviews90dDelta, " vs prior 90 days"),
    },
    {
      label: "REVIEW GAP VS TOP 3",
      value: `+${kpis.reviewGap}`,
      icon: Building2,
      iconWrapClassName: "bg-orange-50",
      iconClassName: "text-orange-600",
      sub: "More to match top 3",
    },
    {
      label: "RESPONSE RATE",
      value: `${kpis.responseRate}%`,
      icon: CheckCircle2,
      iconWrapClassName: "bg-emerald-50",
      iconClassName: "text-emerald-600",
      ...kpiDeltaSub(kpis.responseRateDelta, "% vs prior 90 days"),
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-3 xl:grid-cols-5">
      {cards.map((c) => (
        <GridMetricCard key={c.label} compact {...c} />
      ))}
    </div>
  );
}

export function ReviewsTabs({
  active,
  onChange,
}: {
  active: ReviewsTabId;
  onChange: (tab: ReviewsTabId) => void;
}) {
  return (
    <TabBar
      className="[&>div]:gap-4 [&_button]:pb-2"
      tabs={REVIEWS_TABS.map((t) => ({ id: t.id as ReviewsTabId, label: t.label }))}
      active={active}
      onChange={onChange}
    />
  );
}

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ id: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium transition-colors",
            value === opt.id ? "bg-emerald-600 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function SuggestedActionsSidebar({
  suggestions,
  businessId,
  onTabChange,
}: {
  suggestions: ReviewsPageData["suggestions"];
  businessId: string;
  onTabChange?: (tab: ReviewsTabId) => void;
}) {
  const icons: Record<string, LucideIcon> = {
    reply: MessageSquare,
    request: Mail,
    competitor: TrendingUp,
    sentiment: Sparkles,
  };

  return (
    <RvCard className="sticky top-6 !p-4">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-emerald-600" />
        <h3 className="text-sm font-semibold text-zinc-900">Suggested Actions</h3>
      </div>
      <div className="space-y-2">
        {suggestions.map((s) => {
          const Icon = icons[s.type] ?? MessageSquare;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                if (s.type === "reply") onTabChange?.("unanswered");
                else if (s.type === "request") window.location.href = `/businesses/${businessId}/review-requests`;
                else if (s.type === "sentiment") onTabChange?.("sentiment");
                else if (s.type === "competitor") onTabChange?.("competitor-reviews");
              }}
              className="flex w-full items-start gap-3 rounded-lg border border-zinc-100 bg-zinc-50/50 p-3 text-left transition-colors hover:border-emerald-200 hover:bg-emerald-50/40"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-600 shadow-sm ring-1 ring-zinc-100">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-900">{s.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-zinc-500 line-clamp-2">{s.description}</p>
              </div>
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-zinc-400" />
            </button>
          );
        })}
      </div>
      <button type="button" className="mt-4 text-sm font-medium text-emerald-600 hover:text-emerald-700">
        View all insights & actions →
      </button>
    </RvCard>
  );
}

export function SuggestedReplyTasksSidebar({ data, businessId }: { data: ReviewsPageData; businessId: string }) {
  const themes = data.sentiment.yours.themes.slice(0, 3);
  return (
    <RvCard className="sticky top-6 !p-4">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-emerald-600" />
        <h3 className="text-sm font-semibold text-zinc-900">Suggested Reply Tasks</h3>
      </div>
      <div className="space-y-3 text-sm">
        {data.unanswered.length > 0 && (
          <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-3">
            <div className="flex items-start gap-2">
              <MessageSquare className="mt-0.5 h-4 w-4 text-emerald-600" />
              <div>
                <p className="font-medium text-zinc-900">{data.unanswered.length} reviews need a response</p>
                <button type="button" className="mt-1 text-xs font-medium text-emerald-600">View tasks →</button>
              </div>
            </div>
          </div>
        )}
        <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-3">
          <div className="flex items-start gap-2">
            <TrendingUp className="mt-0.5 h-4 w-4 text-emerald-600" />
            <div>
              <p className="font-medium text-zinc-900">Maintain Momentum</p>
              <p className="mt-1 text-xs text-zinc-500">
                {data.kpis.avgRatingDelta != null && data.kpis.avgRatingDelta > 0
                  ? `Your rating improved ${data.kpis.avgRatingDelta} stars this period.`
                  : "Keep replying quickly to protect your rating."}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-3">
          <div className="flex items-start gap-2">
            <ThumbsUp className="mt-0.5 h-4 w-4 text-emerald-600" />
            <div>
              <p className="font-medium text-zinc-900">Top Positive Themes</p>
              <ul className="mt-2 space-y-1 text-xs text-zinc-600">
                {themes.map((t) => (
                  <li key={t.themeId} className="capitalize">
                    {t.label} ({t.reviewCount})
                  </li>
                ))}
              </ul>
              <button type="button" className="mt-2 text-xs font-medium text-emerald-600">View all themes →</button>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-3">
          <div className="flex items-start gap-2">
            <Shield className="mt-0.5 h-4 w-4 text-emerald-600" />
            <p className="text-xs text-zinc-600">
              Your {data.kpis.responseRate}% response rate is above the local industry average.
            </p>
          </div>
        </div>
        <Link
          href={`/businesses/${businessId}/review-requests`}
          className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700"
        >
          Send review requests →
        </Link>
      </div>
    </RvCard>
  );
}

export function ReviewsPagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  if (total === 0) return null;

  const pages: number[] = [];
  const maxButtons = 5;
  let from = Math.max(1, page - 2);
  const to = Math.min(totalPages, from + maxButtons - 1);
  from = Math.max(1, to - maxButtons + 1);
  for (let i = from; i <= to; i++) pages.push(i);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500">
      <span>
        Showing {start}–{end} of {total} reviews
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded-md px-2 py-1 text-zinc-600 hover:bg-zinc-100 disabled:opacity-40"
        >
          Prev
        </button>
        {pages.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            className={cn(
              "flex h-7 min-w-[1.75rem] items-center justify-center rounded-full px-2",
              p === page ? "bg-emerald-600 text-white" : "text-zinc-600 hover:bg-zinc-100"
            )}
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="rounded-md px-2 py-1 text-zinc-600 hover:bg-zinc-100 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export function ReviewsTable({
  rows,
  mode = "default",
  textDisplay = "preview",
  onViewReview,
}: {
  rows: ReviewListItem[];
  mode?: "default" | "stream" | "urgency";
  textDisplay?: "preview" | "full";
  onViewReview?: (review: ReviewListItem) => void;
}) {
  const showBusiness = mode === "stream";
  const showUrgency = mode === "urgency";

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-100 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            {showBusiness ? <th className="pb-2 pr-3 font-semibold">Business</th> : <th className="pb-2 pr-3">Reviewer</th>}
            <th className="pb-2 pr-3">Rating</th>
            {!showUrgency && <th className="pb-2 pr-3">Date</th>}
            <th className="pb-2 pr-3">{showUrgency ? "Review (excerpt)" : "Review Text"}</th>
            {!showBusiness && !showUrgency && <th className="pb-2 pr-3">Source</th>}
            <th className="pb-2 pr-3">Keywords</th>
            {showUrgency && (
              <>
                <th className="pb-2 pr-3">Days Waiting</th>
                <th className="pb-2 pr-3">SLA / Urgency</th>
              </>
            )}
            <th className="pb-2 pr-3">Status</th>
            <th className="pb-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className={cn("border-b border-zinc-50 hover:bg-zinc-50/60", onViewReview && "cursor-pointer")}
              onClick={() => onViewReview?.(row)}
            >
              <td className="py-2.5 pr-3">
                {showBusiness ? (
                  <BusinessCell row={row} />
                ) : (
                  <div className="flex items-center gap-2">
                    <ReviewerAvatar name={row.reviewerName} size="sm" />
                    <div>
                      <p className="font-medium text-zinc-900">{row.reviewerName}</p>
                      <p className="text-[11px] text-zinc-500">Reviewer</p>
                    </div>
                  </div>
                )}
              </td>
              <td className="py-2.5 pr-3">
                <StarRating rating={row.rating} />
              </td>
              {!showUrgency && (
                <td className="py-2.5 pr-3 whitespace-nowrap">
                  <p className="text-zinc-900">
                    {row.reviewDate
                      ? new Date(row.reviewDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                      : "—"}
                  </p>
                  {row.relativeDate && <p className="text-[11px] text-zinc-500">{row.relativeDate}</p>}
                </td>
              )}
              <td className="min-w-[200px] max-w-md py-2.5 pr-3">
                {textDisplay === "full" ? (
                  <p className="whitespace-pre-wrap text-zinc-700">{row.reviewText?.trim() || "—"}</p>
                ) : (
                  <div>
                    <p className="line-clamp-3 text-zinc-600">{row.reviewText ?? "—"}</p>
                    {onViewReview && row.reviewText && row.reviewText.length > 120 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewReview(row);
                        }}
                        className="mt-1 text-xs font-medium text-emerald-600 hover:text-emerald-700"
                      >
                        Read full review
                      </button>
                    )}
                  </div>
                )}
              </td>
              {!showBusiness && !showUrgency && (
                <td className="py-2.5 pr-3">
                  <SourceIcon source={row.source} />
                </td>
              )}
              <td className="py-2.5 pr-3">
                <TagPills tags={row.tags} />
              </td>
              {showUrgency && (
                <>
                  <td className="py-2.5 pr-3">
                    <span className={cn("text-sm font-medium", (row.daysWaiting ?? 0) >= 7 ? "text-red-600" : "text-amber-600")}>
                      {row.daysWaiting ?? 0} days
                    </span>
                  </td>
                  <td className="py-2.5 pr-3">
                    <UrgencyBadge urgency={row.urgency} />
                  </td>
                </>
              )}
              <td className="py-2.5 pr-3">
                <ReviewStatusBadge replied={row.replied} variant={mode === "default" ? "pill" : "default"} />
              </td>
              <td className="py-2.5">
                <div className="flex items-center gap-1">
                  {!row.replied && (
                    <button
                      type="button"
                      onClick={(e) => e.stopPropagation()}
                      className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100"
                      title="Reply"
                    >
                      <MessageSquare className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewReview?.(row);
                    }}
                    className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100"
                    title="View full review"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={(e) => e.stopPropagation()} className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function KeywordList({
  items,
  title,
  linkLabel,
}: {
  items: Array<{ keyword: string; count: number }>;
  title: string;
  linkLabel?: string;
}) {
  return (
    <RvCard className="!p-4">
      <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
      <ul className="mt-3 space-y-2.5">
        {items.length === 0 ? (
          <li className="text-sm text-zinc-500">No keywords yet.</li>
        ) : (
          items.map((k) => (
            <li key={k.keyword} className="flex items-center justify-between gap-2 text-sm">
              <span className="capitalize text-zinc-700">{k.keyword}</span>
              <span className="font-semibold tabular-nums text-zinc-900">{k.count}</span>
            </li>
          ))
        )}
      </ul>
      {linkLabel && items.length > 0 && (
        <button type="button" className="mt-4 text-sm font-medium text-emerald-600 hover:text-emerald-700">
          {linkLabel} →
        </button>
      )}
    </RvCard>
  );
}

export function KeywordCloud({ items, title, linkLabel }: { items: Array<{ keyword: string; count: number }>; title: string; linkLabel?: string }) {
  return (
    <RvCard className="!p-4">
      <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.length === 0 ? (
          <p className="text-sm text-zinc-500">No keywords yet.</p>
        ) : (
          items.map((k) => (
            <span key={k.keyword} className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-700">
              <span className="capitalize">{k.keyword}</span>{" "}
              <span className="text-zinc-400">{k.count}</span>
            </span>
          ))
        )}
      </div>
      {linkLabel && items.length > 0 && (
        <button type="button" className="mt-4 text-sm font-medium text-emerald-600 hover:text-emerald-700">
          {linkLabel} →
        </button>
      )}
    </RvCard>
  );
}

export function MiniSpark({ data }: { data: number[] }) {
  return <Sparkline data={data.length ? data : [0, 0, 0, 0]} color="#059669" width={72} height={28} />;
}
