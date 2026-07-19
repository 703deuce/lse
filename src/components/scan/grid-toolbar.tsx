"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { Loader2, Play, Plus } from "lucide-react";
import { rankLabel, GRID_SIZE_OPTIONS } from "@/lib/maps/grid-metrics";
import type { KeywordScanSummary, LocationScanSummary } from "@/lib/maps/scan-queries";
import { LocationSwitcher } from "@/components/scan/location-switcher";
import { DEFAULT_SCAN_PROFILE } from "@/lib/maps/scan-profiles";
import { DEFAULT_MAPS_PROVIDER_MODE } from "@/lib/maps/provider-modes";
import {
  DEFAULT_MAPS_LOCATION_ZOOM,
  MAPS_ZOOM_OPTIONS,
  mapsZoomLabel,
} from "@/lib/maps/maps-zoom";
import { RadiusMilesField } from "@/components/scan/radius-miles-field";
import {
  gridRankCardClass,
  gridRankFieldLabel,
  gridRankFieldSelect,
} from "@/components/scan/grid-rank-ui";
import { cn } from "@/lib/utils";

export interface GridToolbarHandle {
  runScan: (extras?: Record<string, unknown>) => Promise<void>;
  running: boolean;
}

export interface GridToolbarProps {
  businessId: string;
  scanId: string;
  gridSize: number;
  radiusMeters: number;
  selectedKeywordId: string | null;
  selectedLocationId: string | null;
  onKeywordChange: (keywordId: string, scanId: string | null) => void;
  onLocationChange: (location: LocationScanSummary, scanId: string | null) => void;
  onScanStarted?: (scanId: string, keywordId?: string) => void;
  scanRunExtras?: Record<string, unknown>;
  className?: string;
}

const fieldLabel = gridRankFieldLabel;
const fieldSelect = gridRankFieldSelect;

export const GridToolbar = forwardRef<GridToolbarHandle, GridToolbarProps>(function GridToolbar(
  {
    businessId,
    gridSize: initialGridSize,
    radiusMeters: initialRadiusMeters,
    selectedKeywordId,
    selectedLocationId,
    onKeywordChange,
    onLocationChange,
    onScanStarted,
    scanRunExtras,
    className,
  },
  ref
) {
  const [keywords, setKeywords] = useState<KeywordScanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");
  const [showAddKeyword, setShowAddKeyword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runGridSize, setRunGridSize] = useState(initialGridSize);
  const [runRadiusMeters, setRunRadiusMeters] = useState(initialRadiusMeters);
  const [runKeywordId, setRunKeywordId] = useState(selectedKeywordId ?? "");
  const [locationZoom, setLocationZoom] = useState(DEFAULT_MAPS_LOCATION_ZOOM);

  useEffect(() => {
    setRunGridSize(initialGridSize);
    setRunRadiusMeters(initialRadiusMeters);
  }, [initialGridSize, initialRadiusMeters]);

  useEffect(() => {
    if (selectedKeywordId) setRunKeywordId(selectedKeywordId);
  }, [selectedKeywordId]);

  const loadKeywords = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        businessId,
        gridSize: String(runGridSize),
        radius: String(runRadiusMeters),
        list: "1",
        locationId: selectedLocationId ?? "business",
      });
      const res = await fetch(`/api/scans/latest?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load keywords");
      setKeywords(json.keywords ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [businessId, runGridSize, runRadiusMeters, selectedLocationId]);

  useEffect(() => {
    void loadKeywords();
  }, [loadKeywords]);

  const selected = keywords.find((k) => k.id === runKeywordId) ?? keywords[0];

  function viewLatestScan(keywordId: string) {
    const kw = keywords.find((k) => k.id === keywordId);
    if (!kw?.latestScanId) return;
    onKeywordChange(keywordId, kw.latestScanId);
  }

  const runScanForKeyword = useCallback(
    async (extras?: Record<string, unknown>) => {
      if (!selected) return;
      setRunning(true);
      setError(null);
      try {
        const res = await fetch("/api/scans/run-for-keyword", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessId,
            keywordId: selected.id,
            gridSize: runGridSize,
            radiusMeters: runRadiusMeters,
            device: DEFAULT_SCAN_PROFILE.device,
            os: DEFAULT_SCAN_PROFILE.os,
            browser: DEFAULT_SCAN_PROFILE.browser,
            mapsProviderMode: DEFAULT_MAPS_PROVIDER_MODE,
            locationZoom,
            locationId: selectedLocationId,
            ...scanRunExtras,
            ...extras,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Scan failed to start");
        // Redirect here (not via parent) so a stale grid-scan-view cannot keep
        // the user on /grid/{newScanId}. Do NOT call onKeywordChange after this.
        const { goToDashboardAfterScanStart } = await import("@/lib/scans/after-scan-start");
        goToDashboardAfterScanStart(businessId);
        return;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Run failed");
      } finally {
        setRunning(false);
      }
    },
    [
      selected,
      businessId,
      runGridSize,
      runRadiusMeters,
      locationZoom,
      selectedLocationId,
      scanRunExtras,
    ]
  );

  useImperativeHandle(ref, () => ({ runScan: runScanForKeyword, running }), [
    runScanForKeyword,
    running,
  ]);

  async function addKeyword(andRun: boolean) {
    const trimmed = newKeyword.trim();
    if (!trimmed) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/scans/keywords/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, keyword: trimmed }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Add failed");
      setNewKeyword("");
      setShowAddKeyword(false);
      await loadKeywords();
      if (json.keyword?.id) {
        onKeywordChange(json.keyword.id, null);
        if (andRun) {
          const runRes = await fetch("/api/scans/run-for-keyword", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              businessId,
              keywordId: json.keyword.id,
              gridSize: runGridSize,
              radiusMeters: runRadiusMeters,
              device: DEFAULT_SCAN_PROFILE.device,
              os: DEFAULT_SCAN_PROFILE.os,
              browser: DEFAULT_SCAN_PROFILE.browser,
              mapsProviderMode: DEFAULT_MAPS_PROVIDER_MODE,
              locationZoom,
              locationId: selectedLocationId,
            }),
          });
          const runJson = await runRes.json();
          if (!runRes.ok) throw new Error(runJson.error ?? "Scan failed to start");
          const { goToDashboardAfterScanStart } = await import("@/lib/scans/after-scan-start");
          goToDashboardAfterScanStart(businessId);
          return;
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Add failed");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className={cn(gridRankCardClass, "mb-2.5 px-3.5 py-2.5", className)}>
      <div className="flex flex-col gap-2.5 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <label className={fieldLabel}>Keyword</label>
          {loading ? (
            <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
            </div>
          ) : (
            <div className="mt-0.5 flex gap-2">
              <select
                value={runKeywordId || selected?.id || ""}
                onChange={(e) => setRunKeywordId(e.target.value)}
                className={cn(fieldSelect, "flex-1")}
              >
                {keywords.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.keyword}
                    {k.lastScannedAt ? "" : " (no scan yet)"}
                  </option>
                ))}
              </select>
              {selected?.latestScanId ? (
                <button
                  type="button"
                  onClick={() => viewLatestScan(selected.id)}
                  className="shrink-0 rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                  title="View latest scan for this keyword at the selected grid size and radius"
                >
                  View
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setShowAddKeyword((v) => !v)}
                className="shrink-0 rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                title="Add keyword"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <LocationSwitcher
            businessId={businessId}
            keywordId={runKeywordId || selected?.id || null}
            gridSize={runGridSize}
            radiusMeters={runRadiusMeters}
            selectedLocationId={selectedLocationId}
            onLocationChange={onLocationChange}
            compact
          />
        </div>

        <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 xl:grid-cols-3">
          <div>
            <label className={fieldLabel}>Grid</label>
            <select
              value={runGridSize}
              onChange={(e) => setRunGridSize(Number(e.target.value))}
              className={cn(fieldSelect, "mt-0.5")}
            >
              {GRID_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}×{n} ({n * n} pts)
                </option>
              ))}
            </select>
          </div>
          <RadiusMilesField
            valueMeters={runRadiusMeters}
            onChangeMeters={setRunRadiusMeters}
            labelClassName={fieldLabel}
            selectClassName={cn(fieldSelect, "mt-0.5")}
            inputClassName={cn(fieldSelect, "mt-0.5")}
            hint={null}
          />
          <div className="col-span-2 xl:col-span-1">
            <label className={fieldLabel}>Map zoom</label>
            <select
              value={locationZoom}
              onChange={(e) => setLocationZoom(Number(e.target.value))}
              className={cn(fieldSelect, "mt-0.5")}
              title="Default 14 matched Local Falcon. Higher = tighter neighborhood."
            >
              {MAPS_ZOOM_OPTIONS.map((z) => (
                <option key={z} value={z}>
                  {mapsZoomLabel(z)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 self-end">
          <button
            type="button"
            disabled={running || !selected}
            onClick={() => void runScanForKeyword()}
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-[#137752] px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-[#0f6244] disabled:opacity-50"
          >
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Run {runGridSize}×{runGridSize} scan
          </button>
        </div>
      </div>

      {selected && (
        <p className="mt-2 truncate text-[11px] text-zinc-500">
          {selected.lastScannedAt ? (
            <>Last scan: {new Date(selected.lastScannedAt).toLocaleString()}</>
          ) : (
            <span className="text-amber-700">No scan for this keyword yet — click Run to start.</span>
          )}
          {selected.solv != null && <> · SoLV {selected.solv}%</>}
          {selected.latestRank != null && (
            <> · Avg rank #{rankLabel(Math.round(selected.latestRank))}</>
          )}
        </p>
      )}

      {showAddKeyword && (
        <div className="mt-3 flex flex-col gap-2 border-t border-zinc-100 pt-3 sm:flex-row sm:items-center">
          <input
            type="text"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            placeholder='New keyword, e.g. "junk removal woodbridge"'
            className="flex-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-[13px]"
            onKeyDown={(e) => e.key === "Enter" && void addKeyword(false)}
          />
          <button
            type="button"
            disabled={adding || !newKeyword.trim()}
            onClick={() => void addKeyword(false)}
            className="rounded-md border border-zinc-200 px-3.5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}
          </button>
          <button
            type="button"
            disabled={adding || !newKeyword.trim()}
            onClick={() => void addKeyword(true)}
            className="rounded-md bg-[#137752] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0f6244] disabled:opacity-50"
          >
            Add & run scan
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
});
