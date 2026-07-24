import Link from "next/link";
import { AlertTriangle, BarChart3, ChevronRight, Flag, MapPinned, MessageSquareText, Target } from "lucide-react";
import { ModuleHeader, ModulePage, cardClass, moduleStack } from "@/components/ui/design-system";
import { cn } from "@/lib/utils";
import type { ReputationModulesAuditData } from "@/lib/reputation/reputation-modules-audit";

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn(cardClass, "p-4", className)}>{children}</section>;
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

function ActionList({ title, items }: { title: string; items: string[] }) {
  return (
    <Card>
      <h3 className="text-[14px] font-semibold text-zinc-900">{title}</h3>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item} className="rounded-xl bg-zinc-50 px-3 py-2 text-[13px] leading-snug text-zinc-700">
            {item}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function ReputationStrategyReport({
  businessId,
  data,
}: {
  businessId: string;
  data: ReputationModulesAuditData;
}) {
  const topGap = data.competitors.gapRows.find((row) => row.totalGap > 0);

  return (
    <ModulePage className={moduleStack}>
      <ModuleHeader
        title="Reputation Strategy Report"
        subtitle={`Phase 3-5 reputation intelligence for ${data.businessName}.`}
        icon={Target}
        meta={
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[12px] font-medium text-zinc-600">
            Generated {new Date(data.generatedAt).toLocaleDateString()}
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/businesses/${businessId}/reputation/analytics`}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 text-[13px] font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50"
            >
              Analytics
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href={`/businesses/${businessId}/reputation/alerts`}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#137752] px-3 text-[13px] font-semibold text-white shadow-sm hover:bg-[#0f6042]"
            >
              Alerts
              <AlertTriangle className="h-3.5 w-3.5" />
            </Link>
          </div>
        }
      />

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
        <Stat label="Momentum" value={data.analytics.momentumStatus} sub={data.analytics.drivers[0]} />
        <Stat label="30d reviews" value={String(data.analytics.rolling30d)} sub={`${data.analytics.priorPeriod.rolling30dDelta >= 0 ? "+" : ""}${data.analytics.priorPeriod.rolling30dDelta} vs prior`} />
        <Stat label="60d reviews" value={String(data.analytics.rolling60d)} sub={`${data.analytics.priorPeriod.rolling60dDelta >= 0 ? "+" : ""}${data.analytics.priorPeriod.rolling60dDelta} vs prior`} />
        <Stat label="Response rate" value={`${data.analytics.responseRate}%`} sub={data.analytics.avgResponseTimeDays == null ? "Avg response unavailable" : `${data.analytics.avgResponseTimeDays}d avg response`} />
        <Stat label="Active alerts" value={String(data.alerts.activeAlerts.length)} sub={data.alerts.activeAlerts[0]?.title ?? "No active alerts"} />
        <Stat label="Top review gap" value={topGap ? String(topGap.totalGap) : "—"} sub={topGap?.competitorName ?? "No competitor gap"} />
      </div>

      <div className="grid gap-2 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-[#137752]" />
            <h2 className="text-[15px] font-semibold text-zinc-900">Module summaries</h2>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl bg-zinc-50 p-3">
              <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-zinc-400">Analytics</p>
              <p className="mt-1 text-[13px] leading-relaxed text-zinc-700">{data.analytics.explanation}</p>
            </div>
            <div className="rounded-xl bg-zinc-50 p-3">
              <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-zinc-400">Competitors</p>
              <p className="mt-1 text-[13px] leading-relaxed text-zinc-700">
                {data.competitors.gapRows.filter((row) => row.gapExpanding).length} widening gap(s); {data.competitors.positioningOpportunities.length} positioning opportunities.
              </p>
            </div>
            <div className="rounded-xl bg-zinc-50 p-3">
              <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-zinc-400">Insights</p>
              <p className="mt-1 text-[13px] leading-relaxed text-zinc-700">
                {data.insights.responsePerformance.unansweredNegative} unanswered negative(s); {data.insights.responseQuality.qualitySummary.genericPct}% generic replies.
              </p>
            </div>
            <div className="rounded-xl bg-zinc-50 p-3">
              <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-zinc-400">Alerts</p>
              <p className="mt-1 text-[13px] leading-relaxed text-zinc-700">
                {data.alerts.activeAlerts.length} active and {data.alerts.resolvedAlerts.length} resolved/dismissed persisted alerts.
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2">
            <MapPinned className="h-4 w-4 text-[#137752]" />
            <h2 className="text-[15px] font-semibold text-zinc-900">Maps visibility</h2>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-zinc-700">{data.mapsVisibility.summary}</p>
          <dl className="mt-4 space-y-2 text-[13px]">
            <div className="flex justify-between gap-2">
              <dt className="text-zinc-500">Latest scan</dt>
              <dd className="font-medium text-zinc-900">{data.mapsVisibility.latestScanId ? data.mapsVisibility.latestScanId.slice(0, 8) : "—"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-zinc-500">Grid size</dt>
              <dd className="font-medium text-zinc-900">{data.mapsVisibility.gridSize ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-zinc-500">Finished</dt>
              <dd className="font-medium text-zinc-900">
                {data.mapsVisibility.latestFinishedAt ? new Date(data.mapsVisibility.latestFinishedAt).toLocaleDateString() : "—"}
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      <div className="grid gap-2 lg:grid-cols-3">
        <ActionList title="Next 30 days" items={data.recommendedActions.days30} />
        <ActionList title="Next 60 days" items={data.recommendedActions.days60} />
        <ActionList title="Next 90 days" items={data.recommendedActions.days90} />
      </div>

      <div className="grid gap-2 xl:grid-cols-2">
        <Card>
          <div className="flex items-center gap-2">
            <MessageSquareText className="h-4 w-4 text-[#137752]" />
            <h2 className="text-[15px] font-semibold text-zinc-900">Response quality priorities</h2>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[13px]">
            <div className="rounded-xl bg-zinc-50 p-3">Personalized: <strong>{data.insights.responseQuality.qualitySummary.personalizedPct}%</strong></div>
            <div className="rounded-xl bg-zinc-50 p-3">Copy/paste: <strong>{data.insights.responseQuality.qualitySummary.copyPastePct}%</strong></div>
            <div className="rounded-xl bg-zinc-50 p-3">Addresses issue: <strong>{data.insights.responseQuality.qualitySummary.addressesIssuePct}%</strong></div>
            <div className="rounded-xl bg-zinc-50 p-3">Offers resolution: <strong>{data.insights.responseQuality.qualitySummary.offersResolutionPct}%</strong></div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-[#137752]" />
            <h2 className="text-[15px] font-semibold text-zinc-900">Campaign cohorts</h2>
          </div>
          <div className="mt-3 space-y-2">
            {data.campaignCohorts.length === 0 ? (
              <p className="text-[13px] text-zinc-500">No review request campaigns found yet.</p>
            ) : (
              data.campaignCohorts.slice(0, 6).map((cohort) => (
                <div key={cohort.campaignId} className="rounded-xl bg-zinc-50 p-3 text-[13px]">
                  <p className="font-semibold text-zinc-900">{cohort.name}</p>
                  <p className="mt-1 text-zinc-500">
                    Sent {cohort.sentCount} · Failed {cohort.failedCount} · Attributed {cohort.attributedCount} ({cohort.confirmedCount} confirmed, {cohort.likelyCount} likely)
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </ModulePage>
  );
}
