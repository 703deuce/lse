import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Trophy,
  Target,
  MapPin,
  Star,
  Shield,
  Info,
  TrendingUp,
  MessageSquare,
  FileText,
  ArrowUpRight,
  FileBarChart,
  Sparkles,
  Grid3X3,
} from "lucide-react";
import { ScoreProgressBar } from "@/components/overview/overview-charts";
import { cn } from "@/lib/utils";
import type { CoreScoreItem } from "@/components/reviews/review-momentum-insights";
import { cardClass, cardLabelClass, StatValue } from "@/components/ui/design-system";

const sectionTitleClass = "text-sm font-semibold text-text";
const sectionSubtitleClass = "mt-0.5 text-xs text-text-muted";

const AUDIT_ICONS: Record<string, { icon: LucideIcon; color: string; barColor: string }> = {
  Overall: { icon: Trophy, color: "text-amber-600 bg-amber-50", barColor: "bg-amber-500" },
  Relevance: { icon: Target, color: "text-blue-600 bg-blue-50", barColor: "bg-blue-500" },
  Distance: { icon: MapPin, color: "text-primary bg-emerald-50", barColor: "bg-emerald-500" },
  Prominence: { icon: Star, color: "text-orange-600 bg-orange-50", barColor: "bg-orange-500" },
  Trust: { icon: Shield, color: "text-primary bg-emerald-50", barColor: "bg-emerald-500" },
};

const CORE_SCORE_ICONS: Record<string, { icon: LucideIcon; color: string }> = {
  "Growth Score": { icon: Sparkles, color: "text-primary bg-emerald-50" },
  "Maps Score": { icon: MapPin, color: "text-blue-600 bg-blue-50" },
  "Review Momentum™": { icon: TrendingUp, color: "text-violet-600 bg-violet-50" },
  "Grid Visibility": { icon: Grid3X3, color: "text-primary bg-emerald-50" },
};

export function OverviewCoreScores({
  businessId,
  scores,
}: {
  businessId: string;
  scores: CoreScoreItem[];
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h2 className={sectionTitleClass}>Core Scores</h2>
          <Info className="h-3.5 w-3.5 text-text-muted" />
        </div>
        <Link
          href={`/businesses/${businessId}/growth-audit`}
          className="text-xs font-medium text-primary hover:text-emerald-700"
        >
          View score details →
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {scores.map((score) => {
          const numValue = typeof score.value === "number" ? score.value : null;
          const meta = CORE_SCORE_ICONS[score.label];
          const Icon = meta?.icon;
          const card = (
            <div className={cn(cardClass, "p-3.5")}>
              <div className="flex items-center gap-2">
                {Icon && meta && (
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
                      meta.color
                    )}
                  >
                    <Icon className="h-3 w-3" />
                  </span>
                )}
                <p className={cardLabelClass}>{score.label}</p>
              </div>
              <div className="mt-1.5">
                <StatValue
                  value={numValue != null ? numValue : "—"}
                  suffix={numValue != null ? "/100" : undefined}
                  score={numValue}
                  className="text-base"
                />
              </div>
              {numValue != null && (
                <div className="mt-2">
                  <ScoreProgressBar score={numValue} />
                </div>
              )}
            </div>
          );
          return score.href ? (
            <Link key={score.label} href={score.href} className="block transition hover:opacity-90">
              {card}
            </Link>
          ) : (
            <div key={score.label}>{card}</div>
          );
        })}
      </div>
    </section>
  );
}

export function OverviewAuditSnapshot({
  scores,
}: {
  scores: Array<{ label: string; value: number | null }>;
}) {
  return (
    <section>
      <div className="mb-3">
        <h2 className={sectionTitleClass}>Audit Snapshot</h2>
        <p className={sectionSubtitleClass}>
          Key factors that impact your local search visibility.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {scores.map((item) => {
          const meta = AUDIT_ICONS[item.label] ?? AUDIT_ICONS.Overall;
          const Icon = meta.icon;
          const num = item.value ?? 0;
          return (
            <div key={item.label} className={cn(cardClass, "p-3.5")}>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
                    meta.color
                  )}
                >
                  <Icon className="h-3 w-3" />
                </span>
                <p className={cardLabelClass}>{item.label}</p>
              </div>
              <div className="mt-1.5">
                <StatValue
                  value={item.value != null ? item.value : "—"}
                  suffix={item.value != null ? "/100" : undefined}
                  score={item.value}
                  className="text-base"
                />
              </div>
              {item.value != null && (
                <div className="mt-1.5">
                  <ScoreProgressBar score={num} color={meta.barColor} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

const ACTION_ICONS = [TrendingUp, MessageSquare, FileText];

function actionIcon(index: number) {
  return ACTION_ICONS[index % ACTION_ICONS.length];
}

function impactBadgeClass(impact: string | null) {
  if (impact === "high") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (impact === "medium") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-surface-subtle text-text-muted border-border";
}

function impactLabel(impact: string | null) {
  if (impact === "high") return "High Impact";
  if (impact === "medium") return "Medium Impact";
  return "Low Impact";
}

export function OverviewRecommendedActions({
  businessId,
  items,
}: {
  businessId: string;
  items: Array<{
    id: string;
    title: string;
    description: string | null;
    impact: string | null;
  }>;
}) {
  if (!items.length) return null;

  return (
    <section>
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <h2 className={sectionTitleClass}>Recommended Actions</h2>
          <p className={sectionSubtitleClass}>
            Prioritized steps to improve your local visibility.
          </p>
        </div>
        <Link
          href={`/businesses/${businessId}/growth-audit?tab=growth-plan`}
          className="shrink-0 text-xs font-medium text-primary hover:text-emerald-700"
        >
          Why these actions?
        </Link>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {items.slice(0, 3).map((item, index) => {
          const Icon = actionIcon(index);
          return (
            <div key={item.id} className={cn(cardClass, "relative flex flex-col p-3.5")}>
              <span className="absolute right-3 top-3 text-lg font-bold text-zinc-100">
                {index + 1}
              </span>
              <div className="flex items-start gap-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-subtle text-text-muted">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1 pr-6">
                  <p className="text-sm font-semibold text-text">{item.title}</p>
                  {item.description && (
                    <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-text-muted">
                      {item.description}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-2.5 flex items-center justify-between gap-2">
                <span
                  className={cn(
                    "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                    impactBadgeClass(item.impact)
                  )}
                >
                  {impactLabel(item.impact)}
                </span>
                <Link
                  href={`/businesses/${businessId}/growth-audit?tab=growth-plan`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-emerald-700"
                >
                  Take Action
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function OverviewFooterCta({ businessId }: { businessId: string }) {
  return (
    <section
      className={cn(
        cardClass,
        "border-emerald-100 bg-gradient-to-r from-emerald-50/90 to-emerald-50/40 p-4"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            <FileBarChart className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-text">Ready to grow faster?</p>
            <p className="mt-0.5 text-xs text-text-muted">
              Get a personalized growth plan with specific actions tailored to your business.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/businesses/${businessId}/growth-audit?tab=growth-plan`}
            className="inline-flex items-center gap-1 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-white hover:bg-primary-hover"
          >
            View Full Growth Plan
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
