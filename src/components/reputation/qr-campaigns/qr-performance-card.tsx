"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Loader2, QrCode } from "lucide-react";
import { RepMetricCard, rep } from "@/components/reputation/rep-ui";
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
    <div className={cn(rep.card, "p-4")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={rep.label}>QR campaigns</p>
          <h3 className="mt-1 text-base font-semibold text-[#101828]">Scan performance</h3>
        </div>
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ECFDF3] text-[#137752]">
          <QrCode className="h-4 w-4" />
        </span>
      </div>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-[#667085]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : error ? (
        <p className="mt-4 text-sm text-[#667085]">QR stats unavailable right now.</p>
      ) : summary.count === 0 ? (
        <p className="mt-3 text-sm text-[#667085]">
          No tracked QR campaigns yet. Create one to measure poster scans.
        </p>
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <RepMetricCard label="Total scans" value={summary.totalScans.toLocaleString()} />
          <RepMetricCard label="Est. unique" value={summary.unique.toLocaleString()} />
          <RepMetricCard
            label="Active / scanned this month"
            value={`${summary.active} / ${summary.scannedThisMonth}`}
          />
        </div>
      )}

      <Link
        href={`/businesses/${businessId}/reputation/qr-campaigns`}
        className={cn(rep.link, "mt-4")}
      >
        View QR campaigns
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
