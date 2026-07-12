"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play, Settings2 } from "lucide-react";
import Link from "next/link";
import { DEFAULT_GRID_SIZE, DEFAULT_RADIUS_METERS } from "@/lib/maps/grid-metrics";
import { DEFAULT_SCAN_PROFILE } from "@/lib/maps/scan-profiles";

export function RunScanButton({
  businessId,
  gridSize = DEFAULT_GRID_SIZE,
  radiusMeters = DEFAULT_RADIUS_METERS,
  showSettingsLink = true,
  variant = "default",
}: {
  businessId: string;
  gridSize?: number;
  radiusMeters?: number;
  showSettingsLink?: boolean;
  variant?: "default" | "overview";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function runScan() {
    setLoading(true);
    try {
      const res = await fetch("/api/scans/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          gridSize,
          radiusMeters,
          scanType: gridSize >= 7 ? "standard" : "quick",
          device: DEFAULT_SCAN_PROFILE.device,
          os: DEFAULT_SCAN_PROFILE.os,
          browser: DEFAULT_SCAN_PROFILE.browser,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/businesses/${businessId}/grid/${data.scan.id}`);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setLoading(false);
    }
  }

  const isOverview = variant === "overview";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={runScan}
        disabled={loading}
        className={
          isOverview
            ? "inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            : "inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
        }
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        Run {gridSize}×{gridSize} Scan
      </button>
      {showSettingsLink && (
        <Link
          href={`/businesses/${businessId}/settings`}
          className={
            isOverview
              ? "inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-4 py-2 text-sm font-semibold text-text shadow-sm hover:bg-surface-subtle"
              : "inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm text-text hover:bg-surface-subtle dark:border-zinc-700 dark:text-zinc-300"
          }
        >
          <Settings2 className="h-4 w-4" />
          Grid Settings
        </Link>
      )}
    </div>
  );
}
