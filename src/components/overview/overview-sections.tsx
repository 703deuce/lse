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
  Phone,
  FileBarChart,
  Sparkles,
  Grid3X3,
} from "lucide-react";
import { ScoreProgressBar } from "@/components/overview/overview-charts";
import { cn } from "@/lib/utils";
import type { CoreScoreItem } from "@/components/reviews/review-momentum-insights";
import { cardClass, cardLabelClass, StatValue, cardGrid } from "@/components/ui/design-system";

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
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-text">Core Scores</h2>
          <Info className="h-3.5 w-3.5 text-text-muted" />
        </div>
        <Link
          href={`/businesses/${businessId}/growth-audit`}
          className="text-sm font-medium text-primary hover:text-emerald-700"
        >
          View score details →
        </Link>
      </div>
      <div className={cardGrid}>
        {scores.map((score) => {
          const numValue = typeof score.value === "number" ? score.value : null;
          const meta = CORE_SCORE_ICONS[score.label];
          const Icon = meta?.icon;
          const card = (
            <div className={cn(cardClass, "p-4")}>
              <div className="flex items-center gap-2">
                {Icon && meta && (
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                      meta.color
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                )}
                <p className={cardLabelClass}>{score.label}</p>
              </div>
              <div className="mt-2">
                <StatValue
                  value={numValue != null ? numValue : "—"}
                  suffix={numValue != null ? "/100" : undefined}
                  score={numValue}
                />
              </div>
              {numValue != null && (
                <div className="mt-3">
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
      <div className="mb-1">
        <h2 className="text-base font-semibold text-text">Audit Snapshot</h2>
        <p className="mt-0.5 text-sm text-text-muted">
          Key factors that impact your local search visibility.
        </p>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {scores.map((item) => {
          const meta = AUDIT_ICONS[item.label] ?? AUDIT_ICONS.Overall;
          const Icon = meta.icon;
          const num = item.value ?? 0;
          return (
            <div
              key={item.label}
              className={cn(cardClass, "p-4")}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                    meta.color
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <p className={cardLabelClass}>{item.label}</p>
              </div>
              <div className="mt-2">
                <StatValue
                  value={item.value != null ? item.value : "—"}
                  suffix={item.value != null ? "/100" : undefined}
                  score={item.value}
                  className="text-xl"
                />
              </div>
              {item.value != null && (
                <div className="mt-2">
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
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-text">Recommended Actions</h2>
          <p className="mt-0.5 text-sm text-text-muted">
            Prioritized steps to improve your local visibility.
          </p>
        </div>
        <Link
          href={`/businesses/${businessId}/growth-audit?tab=growth-plan`}
          className="shrink-0 text-sm font-medium text-primary hover:text-emerald-700"
        >
          Why these actions?
        </Link>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {items.slice(0, 3).map((item, index) => {
          const Icon = actionIcon(index);
          return (
            <div
              key={item.id}
              className={cn(cardClass, "relative flex flex-col p-5")}
            >
              <span className="absolute right-4 top-4 text-2xl font-bold text-zinc-100">
                {index + 1}
              </span>
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-text-muted">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-text">{item.title}</p>
                  {item.description && (
                    <p className="mt-1 text-sm leading-relaxed text-text-muted">{item.description}</p>
                  )}
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <span
                  className={cn(
                    "inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                    impactBadgeClass(item.impact)
                  )}
                >
                  {impactLabel(item.impact)}
                </span>
                <Link
                  href={`/businesses/${businessId}/growth-audit?tab=growth-plan`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-emerald-700"
                >
                  Take Action
                  <ArrowUpRight className="h-3.5 w-3.5" />
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
    <section className={cn(cardClass, "border-emerald-100 bg-gradient-to-r from-emerald-50/90 to-emerald-50/40 p-6")}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <FileBarChart className="h-5 w-5" />
          </span>
          <div>
            <p className="font-semibold text-text">Ready to grow faster?</p>
            <p className="mt-0.5 text-sm text-text-muted">
              Get a personalized growth plan with specific actions tailored to your business.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/businesses/${businessId}/growth-audit?tab=growth-plan`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover"
          >
            View Full Growth Plan
            <ArrowUpRight className="h-4 w-4" />
          </Link>
          <a
            href="https://calendly.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-white text-text-muted hover:bg-surface-subtle"
            aria-label="Book a strategy call"
          >
            <Phone className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
}
