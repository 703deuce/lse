"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play } from "lucide-react";
import { updateBusinessSettings } from "@/lib/actions/mutations";
import {
  DEFAULT_GRID_SIZE,
  DEFAULT_RADIUS_METERS,
  GRID_SIZE_OPTIONS,
  RADIUS_MILE_PRESETS,
  gridScanMeta,
  milesToMeters,
  metersToMiles,
} from "@/lib/maps/grid-metrics";
import { DEFAULT_SCAN_PROFILE } from "@/lib/maps/scan-profiles";

export function ScanSetupForm({
  businessId,
  defaults,
  scanCenter,
  compact = false,
  footerBar = false,
  onDefaultsChange,
}: {
  businessId: string;
  defaults: {
    gridSize: number;
    radiusMeters: number;
    scanCenterLat: number;
    scanCenterLng: number;
  };
  scanCenter?: [number, number];
  compact?: boolean;
  footerBar?: boolean;
  onDefaultsChange?: (next: { gridSize: number; radiusMeters: number }) => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(defaults);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      gridSize: defaults.gridSize,
      radiusMeters: defaults.radiusMeters,
      scanCenterLat: defaults.scanCenterLat,
      scanCenterLng: defaults.scanCenterLng,
    }));
  }, [defaults.gridSize, defaults.radiusMeters, defaults.scanCenterLat, defaults.scanCenterLng]);

  const preview = gridScanMeta(form.gridSize, form.radiusMeters);
  const radiusMiles = metersToMiles(form.radiusMeters);
  const closestPreset = RADIUS_MILE_PRESETS.reduce((best, p) =>
    Math.abs(p.miles - radiusMiles) < Math.abs(best.miles - radiusMiles) ? p : best
  );

  function updateForm(patch: Partial<typeof form>) {
    setForm((prev) => {
      const next = { ...prev, ...patch };
      if (patch.gridSize != null || patch.radiusMeters != null) {
        onDefaultsChange?.({ gridSize: next.gridSize, radiusMeters: next.radiusMeters });
      }
      return next;
    });
  }

  async function saveSettings() {
    const lat = scanCenter?.[0] ?? form.scanCenterLat;
    const lng = scanCenter?.[1] ?? form.scanCenterLng;
    await updateBusinessSettings(businessId, {
      scan_center_lat: lat,
      scan_center_lng: lng,
    });
  }

  async function runScan() {
    setLoading(true);
    try {
      await saveSettings();
      const res = await fetch("/api/scans/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          gridSize: form.gridSize,
          radiusMeters: form.radiusMeters,
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

  const selectClass = footerBar
    ? "mt-1 w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-text"
    : "mt-1 w-full rounded-lg border border-border px-3.5 py-2 dark:border-zinc-700 dark:bg-zinc-900";

  return (
    <div className={compact ? "space-y-2" : "mt-6 space-y-4"}>
      <div
        className={`grid gap-2 ${footerBar ? "lg:grid-cols-3" : compact ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-3"}`}
      >
        <label className="text-xs font-medium text-text-muted">
          Grid size
          <select
            className={selectClass}
            value={form.gridSize}
            onChange={(e) => updateForm({ gridSize: Number(e.target.value) })}
          >
            {GRID_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}×{n} ({n * n} points)
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-text-muted">
          Radius
          <select
            className={selectClass}
            value={closestPreset.miles}
            onChange={(e) => updateForm({ radiusMeters: milesToMeters(Number(e.target.value)) })}
          >
            {RADIUS_MILE_PRESETS.map((p) => (
              <option key={p.miles} value={p.miles}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <button
            type="button"
            onClick={runScan}
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Run {form.gridSize}×{form.gridSize} scan
          </button>
        </div>
      </div>
      {!footerBar && (
        <p className="text-xs text-text-muted">
          {preview.gridSize}×{preview.gridSize} · {preview.radiusMiles} mi radius · ~
          {preview.spacingMiles} mi between pins
        </p>
      )}
    </div>
  );
}

export function defaultScanSetupValues(scanCenterLat: number, scanCenterLng: number) {
  return {
    gridSize: DEFAULT_GRID_SIZE,
    radiusMeters: DEFAULT_RADIUS_METERS,
    scanCenterLat,
    scanCenterLng,
  };
}
