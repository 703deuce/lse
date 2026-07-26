"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Info, Loader2 } from "lucide-react";
import { ModulePage } from "@/components/ui/design-system";
import { RepMetricCard, rep } from "@/components/reputation/rep-ui";
import type { QrCampaignAnalytics } from "@/lib/reputation/qr-campaigns/types";
import { cn } from "@/lib/utils";

const DAY_OPTIONS = [7, 30, 90] as const;

export function QrCampaignAnalyticsView({
  businessId,
  campaignId,
}: {
  businessId: string;
  campaignId: string;
}) {
  const [days, setDays] = useState<(typeof DAY_OPTIONS)[number]>(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<QrCampaignAnalytics | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        businessId,
        days: String(days),
      });
      const res = await fetch(
        `/api/reputation/qr-campaigns/${campaignId}/analytics?${params}`
      );
      const json = (await res.json()) as QrCampaignAnalytics & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to load analytics");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load analytics");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [businessId, campaignId, days]);

  useEffect(() => {
    void load();
  }, [load]);

  const maxDaily = useMemo(() => {
    if (!data?.daily?.length) return 1;
    return Math.max(1, ...data.daily.map((d) => d.totalScans));
  }, [data]);

  const deviceTotal = useMemo(() => {
    if (!data) return 1;
    const b = data.deviceBreakdown;
    return Math.max(1, b.mobile + b.desktop + b.tablet + b.other);
  }, [data]);

  const ratioLabel =
    data?.estimatedScanToReviewRatio != null
      ? `${(data.estimatedScanToReviewRatio * 100).toFixed(1)}%`
      : "—";

  return (
    <ModulePage className={rep.page}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <Link
            href={`/businesses/${businessId}/reputation/qr-campaigns/${campaignId}`}
            className={cn(rep.link, "mb-2")}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to editor
          </Link>
          <h1 className={rep.title}>QR Analytics</h1>
          <p className={rep.subtitle}>
            {data?.campaign?.name
              ? `Scan activity for “${data.campaign.name}”.`
              : "Scan activity for this tracked QR campaign."}
          </p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg border border-[#D0D5DD] bg-white p-1">
          {DAY_OPTIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-semibold transition",
                days === d
                  ? "bg-[#137752] text-white"
                  : "text-[#475467] hover:bg-[#F9FAFB]"
              )}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-[#667085]">
          <Loader2 className="h-5 w-5 animate-spin text-[#137752]" />
          Loading analytics…
        </div>
      ) : error ? (
        <div className={cn(rep.card, "border-dashed p-8 text-center")}>
          <p className="text-sm text-red-700">{error}</p>
          <button type="button" onClick={() => void load()} className={cn(rep.btnSecondary, "mt-4")}>
            Retry
          </button>
        </div>
      ) : data ? (
        <>
          <div className="rounded-xl border border-[#B2DDFF] bg-[#EFF8FF] px-4 py-3 text-sm text-[#175CD3]">
            <div className="flex gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{data.correlationNote}</p>
            </div>
          </div>

          <div>
            <p className={rep.label}>Funnel (correlated, not attributed)</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <RepMetricCard label="Total scans" value={data.totalScans.toLocaleString()} />
              <RepMetricCard
                label="Est. unique"
                value={data.estimatedUniqueScans.toLocaleString()}
                hint="Approximate unique visitors"
              />
              <RepMetricCard
                label="New reviews (period)"
                value={
                  data.newReviewsInPeriod == null
                    ? "—"
                    : data.newReviewsInPeriod.toLocaleString()
                }
                hint="Same window — not proven from QR"
              />
              <RepMetricCard
                label="Est. scan→review ratio"
                value={ratioLabel}
                hint="Correlation only — not exact attribution"
              />
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className={cn(rep.card, "p-4")}>
              <h2 className="text-sm font-semibold text-[#101828]">Device breakdown</h2>
              <p className="mt-0.5 text-xs text-[#667085]">Counted scans in the selected period</p>
              <ul className="mt-4 space-y-3">
                {(
                  [
                    ["Mobile", data.deviceBreakdown.mobile],
                    ["Desktop", data.deviceBreakdown.desktop],
                    ["Tablet", data.deviceBreakdown.tablet],
                    ["Other", data.deviceBreakdown.other],
                  ] as const
                ).map(([label, count]) => (
                  <li key={label}>
                    <div className="mb-1 flex justify-between text-xs text-[#475467]">
                      <span>{label}</span>
                      <span>
                        {count.toLocaleString()} ({Math.round((count / deviceTotal) * 100)}%)
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[#F2F4F7]">
                      <div
                        className="h-full rounded-full bg-[#137752]"
                        style={{ width: `${(count / deviceTotal) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className={cn(rep.card, "p-4")}>
              <h2 className="text-sm font-semibold text-[#101828]">Period snapshot</h2>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className={rep.label}>Scans today</dt>
                  <dd className="mt-1 text-lg font-bold text-[#101828]">{data.scansToday}</dd>
                </div>
                <div>
                  <dt className={rep.label}>Last 7 days</dt>
                  <dd className="mt-1 text-lg font-bold text-[#101828]">{data.scans7d}</dd>
                </div>
                <div>
                  <dt className={rep.label}>In period</dt>
                  <dd className="mt-1 text-lg font-bold text-[#101828]">{data.scans30d}</dd>
                </div>
                <div>
                  <dt className={rep.label}>Prev. period</dt>
                  <dd className="mt-1 text-lg font-bold text-[#101828]">
                    {data.previousPeriodScans}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <div className={cn(rep.card, "p-4")}>
            <h2 className="text-sm font-semibold text-[#101828]">Daily scans</h2>
            <p className="mt-0.5 text-xs text-[#667085]">
              Bars show total counted scans per day in the selected window.
            </p>
            {data.daily.length === 0 ? (
              <p className="mt-6 text-center text-sm text-[#667085]">No daily stats yet.</p>
            ) : (
              <div className="mt-4 flex h-40 items-end gap-1 overflow-x-auto pb-1">
                {data.daily.map((d) => (
                  <div
                    key={d.date}
                    className="flex min-w-[18px] flex-1 flex-col items-center justify-end gap-1"
                    title={`${d.date}: ${d.totalScans} scans, ~${d.estimatedUniqueScans} unique`}
                  >
                    <span className="text-[9px] font-medium text-[#667085]">
                      {d.totalScans || ""}
                    </span>
                    <div
                      className="w-full max-w-[28px] rounded-t bg-[#137752]/85"
                      style={{
                        height: `${Math.max(4, (d.totalScans / maxDaily) * 100)}%`,
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
            {data.daily.length > 0 ? (
              <div className="mt-2 flex justify-between text-[10px] text-[#98A2B3]">
                <span>{data.daily[0]?.date}</span>
                <span>{data.daily[data.daily.length - 1]?.date}</span>
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </ModulePage>
  );
}
