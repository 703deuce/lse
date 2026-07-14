"use client";

import { useMemo, useState } from "react";
import {
  MapPin,
  Phone,
  Building2,
  FileText,
  Link2,
  Clock,
  ChevronRight,
  Lightbulb,
} from "lucide-react";
import { MatchStatusBadge } from "@/components/audit/match-status-badge";
import { BucketBadge } from "@/components/ui/metric-card";
import {
  DotRow,
  FilterPills,
  GaCard,
  GaLink,
  ScoreGaugeCard,
  StatHighlightCard,
} from "@/components/growth-audit/growth-audit-ui";
import type { AuditCheck } from "@/lib/audit/types";
import type { WebsiteMatchSection } from "@/lib/growth-audit/types";

const CHECK_ICONS: Record<string, typeof MapPin> = {
  name: Building2,
  address: MapPin,
  phone: Phone,
  category: FileText,
  hours: Clock,
  website: Link2,
};

function checkIcon(label: string) {
  const key = Object.keys(CHECK_ICONS).find((k) => label.toLowerCase().includes(k));
  return CHECK_ICONS[key ?? "name"] ?? FileText;
}

function signalCounts(checks: AuditCheck[]) {
  const trust = checks.filter((c) => c.bucket === "trust");
  const relevance = checks.filter((c) => c.bucket === "relevance");
  const consistency = checks.filter(
    (c) => c.bucket === "distance" || c.bucket === "prominence" || /phone|name|address|nap/i.test(c.label)
  );
  const passed = (arr: AuditCheck[]) => arr.filter((c) => c.status === "match").length;
  return {
    trust: { passed: passed(trust), total: Math.max(trust.length, 1) },
    relevance: { passed: passed(relevance), total: Math.max(relevance.length, 1) },
    consistency: { passed: passed(consistency), total: Math.max(consistency.length, 1) },
  };
}

export function GrowthAuditWebsiteTab({
  website,
  onGoToActionPlan,
}: {
  website: WebsiteMatchSection;
  onGoToActionPlan: () => void;
}) {
  const [filter, setFilter] = useState("all");
  const signals = signalCounts(website.checks);

  const counts = useMemo(() => {
    const issues = website.checks.filter((c) => c.status === "missing" || c.status === "mismatch").length;
    const warnings = website.checks.filter((c) => c.status === "partial").length;
    const passed = website.checks.filter((c) => c.status === "match").length;
    return { all: website.checks.length, issues, warnings, passed };
  }, [website.checks]);

  const filtered = useMemo(() => {
    if (filter === "issues") return website.checks.filter((c) => c.status === "missing" || c.status === "mismatch");
    if (filter === "warnings") return website.checks.filter((c) => c.status === "partial");
    if (filter === "passed") return website.checks.filter((c) => c.status === "match");
    return website.checks;
  }, [website.checks, filter]);

  const criticalCount = counts.issues;

  return (
    <div className="space-y-4">
      <div className="grid gap-2 lg:grid-cols-5">
        <ScoreGaugeCard title="Website Match Score" score={website.score} size="md" statusVariant="website" />
        <StatHighlightCard
          title="Critical Mismatches"
          value={`${criticalCount} items`}
          subtitle="Fix these to improve local rankings."
          valueClassName="text-red-600"
          footer={<GaLink>View details</GaLink>}
        />
        <StatHighlightCard
          title="Trust Signals"
          value={`${signals.trust.passed}/${signals.trust.total}`}
          subtitle="Strong trust foundation."
          footer={<DotRow total={signals.trust.total} filled={signals.trust.passed} />}
        />
        <StatHighlightCard
          title="Relevance Signals"
          value={`${signals.relevance.passed}/${signals.relevance.total}`}
          subtitle="Good relevance coverage."
          footer={<DotRow total={signals.relevance.total} filled={signals.relevance.passed} />}
        />
        <StatHighlightCard
          title="Consistency Signals"
          value={`${signals.consistency.passed}/${signals.consistency.total}`}
          subtitle="Solid consistency."
          footer={<DotRow total={signals.consistency.total} filled={signals.consistency.passed} />}
        />
      </div>

      <GaCard className="!p-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-3.5 py-2.5">
          <p className="text-[13px] font-semibold text-zinc-900">Website Match Checks</p>
          <FilterPills
            value={filter}
            onChange={setFilter}
            options={[
              { id: "all", label: "All", count: counts.all },
              { id: "issues", label: "Issues", count: counts.issues },
              { id: "warnings", label: "Warnings", count: counts.warnings },
              { id: "passed", label: "Passed", count: counts.passed },
            ]}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/80 text-left text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                <th className="px-3.5 py-2">Check</th>
                <th className="px-3.5 py-2">Status</th>
                <th className="px-3.5 py-2">GBP</th>
                <th className="px-3.5 py-2">Website</th>
                <th className="px-3.5 py-2">Bucket</th>
                <th className="px-3.5 py-2">Recommendation</th>
                <th className="px-3.5 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map((c) => {
                const Icon = checkIcon(c.label);
                return (
                  <tr key={c.id} className="group hover:bg-zinc-50/50">
                    <td className="px-3.5 py-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-50 text-zinc-500">
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="font-medium text-zinc-900">{c.label}</span>
                      </div>
                    </td>
                    <td className="px-3.5 py-2">
                      <MatchStatusBadge status={c.status} />
                    </td>
                    <td className="max-w-[120px] truncate px-3.5 py-2 text-zinc-600">{c.gbpValue ?? "—"}</td>
                    <td className="max-w-[120px] truncate px-3.5 py-2 text-zinc-600">{c.websiteValue ?? "—"}</td>
                    <td className="px-3.5 py-2">
                      <BucketBadge bucket={c.bucket} />
                    </td>
                    <td className="max-w-[180px] px-3.5 py-2 text-[11px] text-zinc-500">
                      {c.whyItMatters ?? (c.status !== "match" ? "Align values across GBP and website." : "—")}
                    </td>
                    <td className="px-3.5 py-2">
                      <ChevronRight className="h-4 w-4 text-zinc-300 group-hover:text-zinc-500" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </GaCard>

      {criticalCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5">
          <div className="flex items-center gap-3">
            <Lightbulb className="h-5 w-5 text-emerald-600" />
            <p className="text-[13px] font-medium text-emerald-900">
              Pro Tip: Fix the {criticalCount} critical issue{criticalCount !== 1 ? "s" : ""} above to unlock an
              estimated +{Math.min(15, criticalCount * 4)} ranking positions.
            </p>
          </div>
          <button
            type="button"
            onClick={onGoToActionPlan}
            className="shrink-0 rounded-lg bg-emerald-700 px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-emerald-800"
          >
            Go to Action Plan →
          </button>
        </div>
      )}
    </div>
  );
}
