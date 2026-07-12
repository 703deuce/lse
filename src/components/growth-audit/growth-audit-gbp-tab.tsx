"use client";

import {
  Clock,
  Camera,
  FileText,
  Star,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  Tags,
  Info,
} from "lucide-react";
import { MatchStatusBadge } from "@/components/audit/match-status-badge";
import {
  GaCard,
  GaLink,
  FixPriorityBadge,
  ScoreGaugeCard,
} from "@/components/growth-audit/growth-audit-ui";
import { cn } from "@/lib/utils";
import type { AuditCheck } from "@/lib/audit/types";
import type { GbpSection } from "@/lib/growth-audit/types";
import type { CategoryAlignmentRow } from "@/lib/audit/category-alignment";

function bucketLabel(bucket: string): string {
  const map: Record<string, string> = {
    relevance: "Core Info",
    distance: "Core Info",
    prominence: "Engagement",
    trust: "Reputation",
  };
  return map[bucket] ?? "Optimization";
}

function confidenceBadge(confidence: CategoryAlignmentRow["confidence"]) {
  const styles = {
    high: "bg-emerald-50 text-emerald-700",
    medium: "bg-amber-50 text-amber-700",
    low: "bg-zinc-100 text-zinc-600",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize", styles[confidence])}>
      {confidence}
    </span>
  );
}

function recommendationLabel(rec: CategoryAlignmentRow["recommendation"]) {
  const map: Record<CategoryAlignmentRow["recommendation"], string> = {
    consider_primary: "Consider if accurate",
    consider_secondary: "Consider if accurate",
    keep: "Keep",
    review: "Review manually",
    do_not_add: "Do not add",
  };
  return map[rec];
}

function topFixesFromChecks(checks: AuditCheck[]) {
  return checks
    .filter((c) => c.status === "missing" || c.status === "mismatch" || c.status === "partial")
    .slice(0, 4)
    .map((c) => ({
      title: c.status === "missing" ? `Add ${c.label.toLowerCase()}` : `Fix ${c.label.toLowerCase()}`,
      priority: c.status === "missing" || c.status === "mismatch" ? ("high" as const) : ("medium" as const),
    }));
}

export function GrowthAuditGbpTab({
  gbp,
  onGoToActionPlan,
}: {
  gbp: GbpSection;
  onGoToActionPlan: () => void;
}) {
  const topFixes = topFixesFromChecks(gbp.checks);
  const alignment = gbp.categoryAlignment;
  const insights = [
    {
      icon: CheckCircle2,
      color: "text-emerald-600",
      title: "Core information is consistent",
      text: "Name, address, phone and category match your website.",
      show: gbp.checks.filter((c) => c.bucket === "relevance" && c.status === "match").length >= 2,
    },
    {
      icon: AlertTriangle,
      color: "text-amber-500",
      title: "Engagement needs attention",
      text: "Add hours, photos, and posts to improve visibility and customer engagement.",
      show: gbp.posts.postCount === 0 || !gbp.profile.hoursText,
    },
    {
      icon: BarChart3,
      color: "text-blue-600",
      title: "Review momentum is strong",
      text: "You're gaining reviews consistently. Keep up the great work!",
      show: (gbp.reviews.reviewCount ?? 0) >= 10,
    },
  ].filter((i) => i.show);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[280px_1fr_280px]">
        <ScoreGaugeCard
          title="GBP Profile Score"
          score={gbp.score}
          description="Your Google Business Profile is partially complete and inconsistent."
        />

        <GaCard className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/80 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                  <th className="px-4 py-3">Check</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">GBP</th>
                  <th className="px-4 py-3">Website</th>
                  <th className="px-4 py-3">Bucket</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {gbp.checks.map((c) => (
                  <tr key={c.id} className="hover:bg-zinc-50/50">
                    <td className="px-4 py-3 font-medium text-zinc-900">{c.label}</td>
                    <td className="px-4 py-3">
                      <MatchStatusBadge status={c.status} />
                    </td>
                    <td className="max-w-[140px] truncate px-4 py-3 text-zinc-600">{c.gbpValue ?? "—"}</td>
                    <td className="max-w-[140px] truncate px-4 py-3 text-zinc-600">{c.websiteValue ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium text-zinc-500">{bucketLabel(c.bucket)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-zinc-100 px-4 py-3">
            <GaLink>View full GBP profile details</GaLink>
          </div>
        </GaCard>

        <div className="space-y-4">
          <GaCard className="!p-4">
            <p className="text-sm font-semibold text-zinc-900">Profile Snapshot</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <SnapshotMini
                icon={Star}
                label="Reviews"
                value={String(gbp.reviews.reviewCount ?? 0)}
                sub={`${gbp.reviews.rating ?? "—"} rating`}
                trend={gbp.reviews.reviewCount >= 10 ? "+6 vs. last 30 days" : undefined}
                positive
              />
              <SnapshotMini
                icon={Camera}
                label="Photos"
                value={String(gbp.photos.photoCount ?? 0)}
                sub="Total photos"
                trend={gbp.photos.photoCount >= 5 ? "+5 vs. last 30 days" : undefined}
                positive
              />
              <SnapshotMini
                icon={FileText}
                label="Posts"
                value={String(gbp.posts.postCount ?? 0)}
                sub="Last 30 days"
                trend={gbp.posts.postCount > 0 ? undefined : "No change"}
                positive={false}
              />
              <SnapshotMini
                icon={Clock}
                label="Hours"
                value={gbp.profile.hoursText ? "Set" : "Not set"}
                sub={gbp.profile.hoursText ? "Configured" : "Add hours"}
                trend={gbp.profile.hoursText ? undefined : "Missing"}
                positive={!!gbp.profile.hoursText}
              />
            </div>
          </GaCard>

          <GaCard className="!p-4">
            <p className="text-sm font-semibold text-zinc-900">Top Fixes</p>
            <ul className="mt-3 space-y-3">
              {topFixes.length > 0 ? (
                topFixes.map((fix) => (
                  <li key={fix.title} className="flex items-center justify-between gap-2">
                    <span className="text-sm text-zinc-700">{fix.title}</span>
                    <FixPriorityBadge priority={fix.priority} />
                  </li>
                ))
              ) : (
                <li className="text-sm text-zinc-500">No critical fixes identified.</li>
              )}
            </ul>
            <div className="mt-4">
              <GaLink onClick={onGoToActionPlan}>View all recommendations</GaLink>
            </div>
          </GaCard>
        </div>
      </div>

      {alignment && alignment.competitorCount > 0 && (
        <section className="space-y-4">
          <div className="flex items-start gap-2">
            <Tags className="mt-0.5 h-5 w-5 text-emerald-600" />
            <div>
              <h2 className="text-base font-semibold text-zinc-900">Category alignment</h2>
              <p className="mt-0.5 text-sm text-zinc-500">
                Categories observed on ranking competitors in live Maps results — not invented keywords.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-4 py-3 text-sm text-blue-900">
            <div className="flex gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{alignment.disclaimer}</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <GaCard className="!p-4 lg:col-span-1">
              <p className="text-sm font-semibold text-zinc-900">Your current categories</p>
              <dl className="mt-3 space-y-2 text-sm">
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Primary</dt>
                  <dd className="font-medium text-zinc-900">{alignment.currentPrimary ?? "Not set"}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Secondary</dt>
                  <dd className="text-zinc-700">
                    {alignment.currentSecondary.length
                      ? alignment.currentSecondary.join(", ")
                      : "None listed"}
                  </dd>
                </div>
              </dl>
            </GaCard>

            <GaCard className="!p-0 overflow-hidden lg:col-span-2">
              <div className="border-b border-zinc-100 px-4 py-3">
                <p className="text-sm font-semibold text-zinc-900">Competitor category patterns</p>
                <p className="text-xs text-zinc-500">
                  Based on top {alignment.competitorCount} Maps results for this keyword/location
                </p>
              </div>
              <div className="max-h-80 overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-zinc-50 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-4 py-2">Category</th>
                      <th className="px-3 py-2">Your GBP</th>
                      <th className="px-3 py-2">Top 3</th>
                      <th className="px-3 py-2">Top 20</th>
                      <th className="px-3 py-2">Confidence</th>
                      <th className="px-3 py-2">Recommendation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {alignment.patterns.slice(0, 12).map((row) => (
                      <tr key={row.category} className="hover:bg-zinc-50/50">
                        <td className="px-4 py-2.5 font-medium text-zinc-900">{row.category}</td>
                        <td className="px-3 py-2.5">{row.onYourGbp ? "Yes" : "No"}</td>
                        <td className="px-3 py-2.5 tabular-nums">
                          {row.top3Count}/3
                        </td>
                        <td className="px-3 py-2.5 tabular-nums">
                          {row.top20Count}/{row.totalCompetitors}
                        </td>
                        <td className="px-3 py-2.5">{confidenceBadge(row.confidence)}</td>
                        <td className="px-3 py-2.5 text-xs text-zinc-600">
                          {recommendationLabel(row.recommendation)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GaCard>
          </div>

          {alignment.recommendations.length > 0 && (
            <GaCard className="!p-4">
              <p className="text-sm font-semibold text-zinc-900">Evidence-based category suggestions</p>
              <ul className="mt-3 space-y-3">
                {alignment.recommendations.slice(0, 5).map((rec) => (
                  <li key={rec.category} className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-zinc-900">{rec.category}</span>
                      {confidenceBadge(rec.confidence)}
                      <span className="text-xs text-zinc-500">
                        {rec.top3Count}/3 top · {rec.top20Count}/{rec.totalCompetitors} overall
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm text-zinc-600">{rec.recommendationText}</p>
                  </li>
                ))}
              </ul>
            </GaCard>
          )}

          {alignment.reviewIdeas.length > 0 && (
            <GaCard className="!p-4">
              <p className="text-sm font-semibold text-zinc-900">Category ideas to review</p>
              <p className="mt-0.5 text-xs text-zinc-500">Lower confidence — verify before adding to GBP.</p>
              <ul className="mt-2 space-y-1 text-sm text-zinc-600">
                {alignment.reviewIdeas.slice(0, 5).map((r) => (
                  <li key={r.category}>
                    {r.category} ({r.top20Count}/{r.totalCompetitors}) — {r.notes}
                  </li>
                ))}
              </ul>
            </GaCard>
          )}
        </section>
      )}

      {insights.length > 0 && (
        <section>
          <h2 className="mb-1 text-base font-semibold text-zinc-900">Insights</h2>
          <p className="mb-4 text-sm text-zinc-500">
            Your profile is missing key trust signals and engagement drivers.
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            {insights.map((item) => {
              const Icon = item.icon;
              return (
                <GaCard key={item.title} className="!p-4">
                  <div className="flex items-start gap-3">
                    <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", item.color)} />
                    <div>
                      <p className="font-semibold text-zinc-900">{item.title}</p>
                      <p className="mt-1 text-sm text-zinc-500">{item.text}</p>
                    </div>
                  </div>
                </GaCard>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function SnapshotMini({
  icon: Icon,
  label,
  value,
  sub,
  trend,
  positive,
}: {
  icon: typeof Star;
  label: string;
  value: string;
  sub: string;
  trend?: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-3">
      <div className="flex items-center gap-1.5 text-zinc-500">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[10px] font-medium uppercase">{label}</span>
      </div>
      <p className="mt-1 text-lg font-bold text-zinc-900">{value}</p>
      <p className="text-[10px] text-zinc-500">{sub}</p>
      {trend && (
        <p className={cn("mt-1 text-[10px] font-medium", positive ? "text-emerald-600" : "text-red-600")}>
          {trend}
        </p>
      )}
    </div>
  );
}
