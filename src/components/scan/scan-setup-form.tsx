"use client";

import { useEffect, useState } from "react";
import { Loader2, Play } from "lucide-react";
import { updateBusinessSettings } from "@/lib/actions/mutations";
import {
  DEFAULT_GRID_SIZE,
  DEFAULT_RADIUS_METERS,
  GRID_SIZE_OPTIONS,
  gridScanMeta,
} from "@/lib/maps/grid-metrics";
import { DEFAULT_SCAN_PROFILE } from "@/lib/maps/scan-profiles";
import { DEFAULT_MAPS_PROVIDER_MODE } from "@/lib/maps/provider-modes";
import {
  DEFAULT_MAPS_LOCATION_ZOOM,
  MAPS_ZOOM_OPTIONS,
  mapsZoomLabel,
} from "@/lib/maps/maps-zoom";
import { RadiusMilesField } from "@/components/scan/radius-miles-field";

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
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(defaults);
  const [locationZoom, setLocationZoom] = useState(DEFAULT_MAPS_LOCATION_ZOOM);

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
      const lat = scanCenter?.[0] ?? form.scanCenterLat;
      const lng = scanCenter?.[1] ?? form.scanCenterLng;
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
          mapsProviderMode: DEFAULT_MAPS_PROVIDER_MODE,
          locationZoom,
          centerLat: lat,
          centerLng: lng,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const { goToDashboardAfterScanStart } = await import("@/lib/scans/after-scan-start");
      goToDashboardAfterScanStart(businessId);
      return;
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
        <RadiusMilesField
          valueMeters={form.radiusMeters}
          onChangeMeters={(meters) => updateForm({ radiusMeters: meters })}
          labelClassName="text-xs font-medium text-text-muted"
          selectClassName={selectClass}
          inputClassName={selectClass}
          hint={null}
        />
        <label className="text-xs font-medium text-text-muted">
          Map zoom
          <select
            className={selectClass}
            value={locationZoom}
            onChange={(e) => setLocationZoom(Number(e.target.value))}
          >
            {MAPS_ZOOM_OPTIONS.map((z) => (
              <option key={z} value={z}>
                {mapsZoomLabel(z)}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end sm:col-span-2 lg:col-span-1">
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
