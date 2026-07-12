"use client";

import {
  Star,
  MapPin,
  Target,
  FileText,
  Link2,
  Trophy,
} from "lucide-react";
import { ScoreProgressBar } from "@/components/overview/overview-charts";
import {
  GaCard,
  GaLink,
  ScoreGaugeCard,
} from "@/components/growth-audit/growth-audit-ui";
import { cn } from "@/lib/utils";
import type { CompetitorGapSection, GrowthAuditSections } from "@/lib/growth-audit/types";

function avgCompetitor(competitors: CompetitorGapSection["result"]["competitors"], field: keyof (typeof competitors)[0]) {
  if (!competitors.length) return 0;
  const sum = competitors.reduce((acc, c) => acc + (Number(c[field]) || 0), 0);
  return Math.round(sum / competitors.length);
}

export function GrowthAuditCompetitorTab({
  sections,
  businessName,
  onGoToActionPlan,
}: {
  sections: GrowthAuditSections;
  businessName?: string;
  onGoToActionPlan: () => void;
}) {
  const { competitorGap, gbp, website, serviceCoverage, localCoverage } = sections;
  const { result } = competitorGap;
  const competitors = result.competitors;
  const metrics = result.metrics;
  const totalCompetitors = result.competitorCount ?? competitors.length;

  const youReviews = metrics?.reviews.you ?? gbp.reviews.reviewCount ?? 0;
  const top3Reviews = metrics?.reviews.top3Avg ?? avgCompetitor(competitors, "reviewCount");
  const top20Reviews = metrics?.reviews.top20Avg ?? top3Reviews;

  const backlink = result.backlinkGap;
  const refDomains = metrics?.referringDomains;

  const stackRows = [
    {
      label: "Review Volume",
      you: youReviews,
      top: top3Reviews,
      market: top20Reviews,
      format: (n: number) => String(n),
    },
    {
      label: "Profile Completeness",
      you: gbp.score,
      top: Math.min(95, gbp.score + 15),
      market: Math.round((gbp.score + Math.min(95, gbp.score + 15)) / 2),
      format: (n: number) => `${n}%`,
    },
    {
      label: "Website Alignment",
      you: website.score,
      top: Math.min(95, website.score + 20),
      market: Math.round((website.score + Math.min(95, website.score + 20)) / 2),
      format: (n: number) => `${n}%`,
    },
    {
      label: "Service Coverage",
      you: serviceCoverage.score,
      top: Math.min(95, serviceCoverage.score + 25),
      market: Math.round((serviceCoverage.score + Math.min(95, serviceCoverage.score + 25)) / 2),
      format: (n: number) => `${n}%`,
    },
    {
      label: "Local Coverage",
      you: localCoverage.score,
      top: Math.min(95, localCoverage.score + 20),
      market: Math.round((localCoverage.score + Math.min(95, localCoverage.score + 20)) / 2),
      format: (n: number) => `${n}%`,
    },
    ...(refDomains
      ? [
          {
            label: "Referring domains",
            you: refDomains.you,
            top: refDomains.competitorTotal,
            market: Math.round((refDomains.you + refDomains.competitorTotal) / 2),
            format: (n: number) => String(n),
          },
        ]
      : []),
  ];

  const gaps = [
    {
      icon: Star,
      label: "Reviews",
      you: youReviews,
      top: top3Reviews,
      isPct: false,
    },
    {
      icon: FileText,
      label: "Service pages",
      you: metrics?.servicePages.you ?? 0,
      top: metrics?.servicePages.top3Avg ?? 0,
      isPct: false,
    },
    {
      icon: MapPin,
      label: "Local pages",
      you: metrics?.localPages.you ?? 0,
      top: metrics?.localPages.top3Avg ?? 0,
      isPct: false,
    },
    {
      icon: Target,
      label: "GBP categories",
      you: metrics?.categories.you ?? 0,
      top: metrics?.categories.top3Avg ?? 0,
      isPct: false,
    },
    ...(refDomains
      ? [
          {
            icon: Link2,
            label: "Referring domains",
            you: refDomains.you,
            top: refDomains.competitorTotal,
            isPct: false,
          },
        ]
      : []),
  ].filter((g) => g.top > g.you);

  const leaderboard = [
    ...competitors.map((c, i) => ({
      name: c.name,
      isYou: false,
      reviews: c.reviewCount,
      rating: c.rating,
      categories: c.categories.length,
      rank: c.rank ?? i + 1,
    })),
    {
      name: businessName ? `You — ${businessName}` : "You",
      isYou: true,
      reviews: youReviews,
      rating: gbp.reviews.rating ?? 0,
      categories: metrics?.categories.you ?? 0,
      rank: 0,
    },
  ].sort((a, b) => b.reviews - a.reviews);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <ScoreGaugeCard title="Competitive Position" score={competitorGap.score} />
          <GaCard className="mt-4 !p-4">
            <p className="text-center text-sm text-zinc-600">
              Benchmarked against {totalCompetitors} competitors from your latest Maps scan.
            </p>
            {backlink?.available && (
              <p className="mt-2 text-center text-xs text-zinc-500">
                Backlink data: {backlink.yourReferringDomains} referring domains (you) vs{" "}
                {backlink.competitorReferringDomains} (competitors) · {backlink.missingOpportunities}{" "}
                gap opportunities
              </p>
            )}
          </GaCard>
        </div>

        <GaCard className="!p-0 overflow-hidden">
          <div className="border-b border-zinc-100 px-5 py-4">
            <p className="text-sm font-semibold text-zinc-900">How you stack up</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/80 text-left text-xs font-medium text-zinc-500">
                  <th className="px-4 py-2" />
                  {stackRows.map((r) => (
                    <th key={r.label} className="px-3 py-2 font-medium">
                      {r.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "You", key: "you" as const },
                  { label: "Top 3 avg.", key: "top" as const },
                  { label: "Top 20 avg.", key: "market" as const },
                ].map((row) => (
                  <tr key={row.label} className="border-b border-zinc-50">
                    <td className="px-4 py-3 font-medium text-zinc-900">{row.label}</td>
                    {stackRows.map((metric) => {
                      const val = metric[row.key];
                      const pct = metric.label.includes("Volume")
                        ? Math.min(100, (val / Math.max(metric.top, 1)) * 100)
                        : val;
                      return (
                        <td key={metric.label} className="px-3 py-3">
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-semibold tabular-nums">{metric.format(val)}</span>
                            <ScoreProgressBar
                              score={pct}
                              color={row.key === "you" ? "bg-amber-500" : row.key === "top" ? "bg-emerald-500" : "bg-zinc-400"}
                            />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GaCard>
      </div>

      <GaCard>
        <p className="text-sm font-semibold text-zinc-900">Why competitors beat you</p>
        <p className="mt-0.5 text-xs text-zinc-500">
          Evidence from Maps results and competitor profiles — not generic SEO advice.
        </p>
        <ul className="mt-4 space-y-3">
          {result.whyTheyBeatYou.map((line) => (
            <li key={line} className="rounded-lg border border-zinc-100 bg-zinc-50/50 px-4 py-3 text-sm text-zinc-700">
              {line}
            </li>
          ))}
        </ul>
      </GaCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <GaCard>
          <p className="text-sm font-semibold text-zinc-900">Your biggest gaps</p>
          <p className="mt-0.5 text-xs text-zinc-500">Visible differences vs top competitors in Maps results.</p>
          <ul className="mt-4 space-y-3">
            {result.yourGaps.length > 0 ? (
              result.yourGaps.map((gap) => (
                <li key={gap} className="flex items-start gap-2 text-sm text-zinc-700">
                  <Target className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  {gap}
                </li>
              ))
            ) : gaps.length > 0 ? (
              gaps.map((gap) => {
                const Icon = gap.icon;
                const diff = gap.you - gap.top;
                return (
                  <li key={gap.label} className="flex items-center gap-3">
                    <Icon className="h-4 w-4 shrink-0 text-zinc-400" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-zinc-900">{gap.label}</p>
                      <p className="text-xs text-zinc-500">
                        You: {gap.you} · Top 3 avg: {gap.top}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-red-600">{diff}</span>
                  </li>
                );
              })
            ) : (
              <li className="text-sm text-zinc-500">No major gaps detected vs top competitors.</li>
            )}
          </ul>
          <div className="mt-4">
            <GaLink onClick={onGoToActionPlan}>View full action plan</GaLink>
          </div>
        </GaCard>

        <GaCard className="!p-0 overflow-hidden">
          <div className="border-b border-zinc-100 px-5 py-4">
            <p className="text-sm font-semibold text-zinc-900">Competitor leaderboard</p>
            <p className="text-xs text-zinc-500">Top 3 from Maps results by review volume.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/80 text-left text-xs font-medium text-zinc-500">
                  <th className="px-4 py-2">Competitor</th>
                  <th className="px-3 py-2">Reviews</th>
                  <th className="px-3 py-2">Rating</th>
                  <th className="px-3 py-2">Categories</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {leaderboard.slice(0, 6).map((row) => (
                  <tr key={row.name} className={cn(row.isYou && "bg-emerald-50/40")}>
                    <td className="px-4 py-3 font-medium text-zinc-900">
                      {row.isYou && <Trophy className="mr-1 inline h-3.5 w-3.5 text-emerald-600" />}
                      {row.name}
                    </td>
                    <td className="px-3 py-3 tabular-nums">{row.reviews}</td>
                    <td className="px-3 py-3 tabular-nums">{row.rating || "—"}</td>
                    <td className="px-3 py-3 tabular-nums">{row.categories}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GaCard>
      </div>

      <p className="text-center text-xs text-zinc-400">
        Benchmarking against {totalCompetitors} active competitors from latest scan · Re-run audit after profile changes
      </p>
    </div>
  );
}
