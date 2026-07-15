"use client";

import { Briefcase, MapPin, ExternalLink, AlertCircle, Star } from "lucide-react";
import { Sparkline } from "@/components/overview/overview-charts";
import {
  GaCard,
  GaLink,
  ScoreGaugeCard,
} from "@/components/growth-audit/growth-audit-ui";
import { cn } from "@/lib/utils";
import type { GrowthAuditSections } from "@/lib/growth-audit/types";

function statusTag(status: string) {
  const styles: Record<string, string> = {
    excellent: "bg-emerald-50 text-emerald-700",
    weak: "bg-amber-50 text-amber-700",
    missing: "bg-red-50 text-red-700",
    needs_improvement: "bg-amber-50 text-amber-700",
    covered: "bg-emerald-50 text-emerald-700",
  };
  const labels: Record<string, string> = {
    excellent: "Covered",
    weak: "Weak",
    missing: "Missing",
    needs_improvement: "Weak",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", styles[status] ?? "bg-zinc-100 text-zinc-600")}>
      {labels[status] ?? status.replace(/_/g, " ")}
    </span>
  );
}

function opportunityTag(level: string) {
  const styles: Record<string, string> = {
    high: "bg-red-50 text-red-700",
    medium: "bg-amber-50 text-amber-700",
    low: "bg-zinc-100 text-zinc-600",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize", styles[level] ?? "")}>
      {level}
    </span>
  );
}

export function GrowthAuditCoverageTab({ sections }: { sections: GrowthAuditSections }) {
  const { serviceCoverage, localCoverage } = sections;
  const coverageScore = Math.round((serviceCoverage.score + localCoverage.score) / 2);
  const serviceRows = serviceCoverage.rows.slice(0, 8);
  const keywordRows = serviceCoverage.serviceKeywords?.rows ?? [];
  const localRows = [...localCoverage.neighborhoods, ...localCoverage.cities].slice(0, 6);
  const coveredServices = serviceCoverage.rows.filter((r) => r.pageExists && r.status !== "missing").length;
  const totalServices = serviceCoverage.rows.length || 1;
  const missingServices = serviceCoverage.rows.filter((r) => !r.pageExists || r.status === "missing");
  const weakServices = serviceCoverage.rows.filter((r) => r.status === "weak");
  const missingLocal = localRows.filter((r) => r.status === "missing" || !r.hasPage);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-3">
        <ScoreGaugeCard title="Coverage Score" score={coverageScore} />
        <GaCard className="!p-3.5">
          <p className="text-[11px] font-medium text-zinc-500">Service Coverage Score</p>
          <p className="mt-1.5 text-base font-bold text-zinc-900">
            {serviceCoverage.score}
            <span className="text-[11px] font-medium text-zinc-400">/100</span>
          </p>
          <p className="mt-0.5 text-[11px] font-semibold text-amber-600">Needs Improvement</p>
          <div className="mt-2">
            <Sparkline data={[serviceCoverage.score - 6, serviceCoverage.score - 3, serviceCoverage.score]} color="#059669" />
          </div>
        </GaCard>
        <GaCard className="!p-3.5">
          <p className="text-[11px] font-medium text-zinc-500">Local Coverage Score</p>
          <p className="mt-1.5 text-base font-bold text-zinc-900">
            {localCoverage.score}
            <span className="text-[11px] font-medium text-zinc-400">/100</span>
          </p>
          <p className="mt-0.5 text-[11px] font-semibold text-amber-600">Needs Improvement</p>
          <div className="mt-2">
            <Sparkline data={[localCoverage.score - 4, localCoverage.score - 2, localCoverage.score]} color="#059669" />
          </div>
        </GaCard>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_300px]">
        <GaCard className="!p-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-100 px-3.5 py-2.5">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-emerald-600" />
              <p className="text-[13px] font-semibold text-zinc-900">Service Coverage</p>
            </div>
            <GaLink>View Service Opportunities</GaLink>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/80 text-left text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                  <th className="px-3.5 py-2">Service</th>
                  <th className="px-3.5 py-2">On website</th>
                  <th className="px-3.5 py-2">On GBP</th>
                  <th className="px-3.5 py-2">Competitors</th>
                  <th className="px-3.5 py-2">Opportunity</th>
                  <th className="px-3.5 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {serviceRows.map((row) => (
                  <tr key={row.service} className="hover:bg-zinc-50/50">
                    <td className="px-3.5 py-2 font-medium text-zinc-900">{row.service}</td>
                    <td className="px-3.5 py-2">
                      {row.pageExists ? (
                        row.pageUrl ? (
                          <a
                            href={row.pageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-emerald-600 hover:underline"
                          >
                            Yes
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-emerald-600">Yes</span>
                        )
                      ) : (
                        <span className="text-zinc-400">No</span>
                      )}
                    </td>
                    <td className="px-3.5 py-2">{(row.onYourGbp ?? row.gbpListed) ? "Yes" : "No"}</td>
                    <td className="px-3.5 py-2 tabular-nums text-zinc-600">
                      {row.competitorTop20Count != null
                        ? `${row.competitorTop20Count}/${serviceCoverage.serviceKeywords?.totalCompetitors ?? "—"}`
                        : (row.competitorNote ?? "—")}
                    </td>
                    <td className="px-3.5 py-2">
                      {row.opportunity ? opportunityTag(row.opportunity) : "—"}
                    </td>
                    <td className="px-3.5 py-2">{statusTag(row.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {keywordRows.length > 0 && (
            <p className="border-t border-zinc-100 px-3.5 py-2 text-[11px] text-zinc-500">
              Services derived from competitor Maps place topics and GBP services — not invented keywords.
            </p>
          )}
        </GaCard>

        <GaCard>
          <p className="text-[13px] font-semibold text-zinc-900">Service Coverage Insights</p>
          <div className="mt-3 flex items-center justify-center">
            <div className="relative flex h-24 w-24 items-center justify-center rounded-full border-[10px] border-zinc-100">
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: `conic-gradient(#059669 ${(coveredServices / totalServices) * 360}deg, #e4e4e7 0deg)`,
                  mask: "radial-gradient(farthest-side, transparent calc(100% - 10px), #000 calc(100% - 10px))",
                  WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 10px), #000 calc(100% - 10px))",
                }}
              />
              <span className="text-lg font-bold text-zinc-900">
                {coveredServices}/{totalServices}
              </span>
            </div>
          </div>
          <p className="mt-2 text-center text-[11px] text-zinc-500">
            {Math.round((coveredServices / totalServices) * 100)}% services covered
          </p>
          <ul className="mt-3 space-y-2 text-[13px]">
            {missingServices.length > 0 && (
              <li className="flex items-start gap-2 text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {missingServices.length} high-value services are missing
              </li>
            )}
            {weakServices.length > 0 && (
              <li className="flex items-start gap-2 text-amber-700">
                <Star className="mt-0.5 h-4 w-4 shrink-0" />
                {weakServices.length} services need stronger signals
              </li>
            )}
          </ul>
          <div className="mt-3">
            <GaLink>View Service Recommendations</GaLink>
          </div>
        </GaCard>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_300px]">
        <GaCard className="!p-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-100 px-3.5 py-2.5">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-emerald-600" />
              <p className="text-[13px] font-semibold text-zinc-900">Local Coverage</p>
            </div>
            <GaLink>View Local Opportunities</GaLink>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/80 text-left text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                  <th className="px-3.5 py-2">Area</th>
                  <th className="px-3.5 py-2">Page</th>
                  <th className="px-3.5 py-2">Mentioned on site</th>
                  <th className="px-3.5 py-2">Competitors</th>
                  <th className="px-3.5 py-2">Opportunity</th>
                  <th className="px-3.5 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {localRows.map((row) => (
                  <tr key={row.area} className="hover:bg-zinc-50/50">
                    <td className="px-3.5 py-2 font-medium text-zinc-900">
                      {row.area}
                      <span className="ml-1.5 text-[10px] font-normal uppercase text-zinc-400">{row.type}</span>
                    </td>
                    <td className="px-3.5 py-2">
                      {row.hasPage ? (
                        <span className="text-emerald-600">Page exists</span>
                      ) : (
                        <span className="text-zinc-400">No page</span>
                      )}
                    </td>
                    <td className="px-3.5 py-2">
                      {row.mentionedOnSite ? (
                        <span className="text-emerald-600">Yes</span>
                      ) : (
                        <span className="text-zinc-400">No</span>
                      )}
                    </td>
                    <td className="px-3.5 py-2 tabular-nums">{row.competitorCount}/20</td>
                    <td className="px-3.5 py-2">{opportunityTag(row.opportunity)}</td>
                    <td className="px-3.5 py-2">{statusTag(row.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GaCard>

        <div className="space-y-3">
          <GaCard>
            <p className="text-[13px] font-semibold text-zinc-900">Market Coverage Map</p>
            <div className="mt-2.5 flex h-32 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-100 via-amber-50 to-red-50">
              <div className="grid grid-cols-3 gap-2 p-3">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-8 w-8 rounded-md opacity-80",
                      i % 3 === 0 ? "bg-emerald-400" : i % 3 === 1 ? "bg-amber-300" : "bg-red-300"
                    )}
                  />
                ))}
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-500">
              <span>High Coverage</span>
              <span>Low Coverage</span>
            </div>
          </GaCard>
          <GaCard>
            <p className="text-[13px] font-semibold text-zinc-900">Local Coverage Insights</p>
            <ul className="mt-2.5 space-y-2 text-[13px] text-zinc-600">
              {missingLocal.length > 0 && (
                <li>{missingLocal.length} high-opportunity areas are missing pages</li>
              )}
              {localRows.filter((r) => r.status === "needs_improvement").length > 0 && (
                <li>{localRows.filter((r) => r.status === "needs_improvement").length} area has weak coverage</li>
              )}
            </ul>
            <div className="mt-3">
              <GaLink>View Local Recommendations</GaLink>
            </div>
          </GaCard>
        </div>
      </div>

      <section>
        <div className="mb-2.5 flex items-center gap-2">
          <Star className="h-4 w-4 text-emerald-600" />
          <h2 className="text-base font-semibold text-zinc-900">Top recommendations</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <GaCard className="!p-3.5">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
                <Briefcase className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[13px] font-semibold text-zinc-900">Missing service pages</p>
                <p className="mt-1 text-[11px] text-zinc-500">
                  {missingServices.length > 0
                    ? `${missingServices.length} GBP-listed services lack a matching page on your site.`
                    : "Review service page coverage against competitors."}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {missingServices.slice(0, 2).map((s) => (
                    <span key={s.service} className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-700">
                      {s.service}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </GaCard>
          <GaCard className="!p-3.5">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                <MapPin className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[13px] font-semibold text-zinc-900">Category gaps from top 20</p>
                <p className="mt-1 text-[11px] text-zinc-500">
                  {serviceCoverage.categoryGap.categoryAlignment?.recommendations.length
                    ? "Categories used by ranking competitors that you may want to review — only if accurate."
                    : "No strong category gaps detected among top competitors."}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(serviceCoverage.categoryGap.categoryAlignment?.recommendations ?? [])
                    .slice(0, 2)
                    .map((r) => (
                      <span key={r.category} className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-700">
                        {r.category}
                      </span>
                    ))}
                </div>
              </div>
            </div>
          </GaCard>
        </div>
      </section>
    </div>
  );
}
