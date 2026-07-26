"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Loader2, QrCode, TrendingUp } from "lucide-react";
import { QrKpiCard, qrUi } from "@/components/reputation/qr-campaigns/qr-ui";
import type { ReviewQrCampaign } from "@/lib/reputation/qr-campaigns/types";
import { cn } from "@/lib/utils";

function isThisMonth(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export function QrPerformanceCard({ businessId }: { businessId: string }) {
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<ReviewQrCampaign[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/reputation/qr-campaigns?businessId=${encodeURIComponent(businessId)}&status=all`
        );
        const json = (await res.json()) as { campaigns?: ReviewQrCampaign[]; error?: string };
        if (!res.ok) throw new Error(json.error ?? "Failed to load");
        if (!cancelled) setCampaigns(json.campaigns ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  const summary = useMemo(() => {
    const active = campaigns.filter((c) => c.status === "active").length;
    const totalScans = campaigns.reduce((n, c) => n + (c.totalScans || 0), 0);
    const unique = campaigns.reduce((n, c) => n + (c.estimatedUniqueScans || 0), 0);
    const scannedThisMonth = campaigns.filter((c) => isThisMonth(c.lastScannedAt)).length;
    return { active, totalScans, unique, scannedThisMonth, count: campaigns.length };
  }, [campaigns]);

  return (
    <div
      className={cn(
        qrUi.card,
        "overflow-hidden border-l-4 border-l-[#16A34A] p-5"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#027A48]">
            QR Campaigns
          </p>
          <h3 className="mt-1 text-lg font-bold text-[#0B1B32]">Scan performance</h3>
          <p className="mt-0.5 text-xs text-[#667085]">
            Track poster scans and review momentum
          </p>
        </div>
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#ECFDF3] text-[#16A34A]">
          <QrCode className="h-5 w-5" />
        </span>
      </div>

      {loading ? (
        <div className="mt-5 flex items-center gap-2 text-sm text-[#667085]">
          <Loader2 className="h-4 w-4 animate-spin text-[#16A34A]" /> Loading…
        </div>
      ) : error ? (
        <p className="mt-5 text-sm text-[#667085]">QR stats unavailable right now.</p>
      ) : summary.count === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-[#A6F4C5] bg-[#ECFDF3]/40 p-4">
          <p className="text-sm text-[#486581]">
            No tracked QR campaigns yet. Create one to measure poster scans.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <QrKpiCard label="Total scans" value={summary.totalScans.toLocaleString()} />
          <QrKpiCard label="Est. unique" value={summary.unique.toLocaleString()} />
          <QrKpiCard
            label="Active / scanned"
            value={`${summary.active} / ${summary.scannedThisMonth}`}
            hint="Active campaigns / scanned this month"
          />
        </div>
      )}

      <Link
        href={`/businesses/${businessId}/reputation/qr-campaigns`}
        className={cn(qrUi.btnPrimary, "mt-5 w-full sm:w-auto")}
      >
        <TrendingUp className="h-4 w-4" />
        View QR Campaigns
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
