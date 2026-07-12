"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { Loader2, Plus, SlidersHorizontal, X } from "lucide-react";
import { rankLabel } from "@/lib/maps/grid-metrics";
import type { KeywordScanSummary, LocationScanSummary } from "@/lib/maps/scan-queries";
import { LocationSwitcher } from "@/components/scan/location-switcher";
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
  onScanStarted?: (scanId: string) => void;
  device?: string;
  os?: string;
  browser?: string;
  scanRunExtras?: Record<string, unknown>;
  actionsInHeader?: boolean;
  className?: string;
}

const fieldLabel = gridRankFieldLabel;
const fieldSelect = gridRankFieldSelect;

export const GridToolbar = forwardRef<GridToolbarHandle, GridToolbarProps>(function GridToolbar(
  {
    businessId,
    gridSize,
    radiusMeters,
    selectedKeywordId,
    selectedLocationId,
    onKeywordChange,
    onLocationChange,
    onScanStarted,
    device = "mobile",
    os = "android",
    browser = "chrome",
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const loadKeywords = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        businessId,
        gridSize: String(gridSize),
        radius: String(radiusMeters),
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
  }, [businessId, gridSize, radiusMeters, selectedLocationId]);

  useEffect(() => {
    void loadKeywords();
  }, [loadKeywords]);

  const selected = keywords.find((k) => k.id === selectedKeywordId) ?? keywords[0];

  async function handleSelect(keywordId: string) {
    const kw = keywords.find((k) => k.id === keywordId);
    if (!kw) return;

    if (kw.latestScanId) {
      onKeywordChange(keywordId, kw.latestScanId);
      return;
    }

    const params = new URLSearchParams({
      businessId,
      keyword: kw.keyword,
      gridSize: String(gridSize),
      radius: String(radiusMeters),
    });
    if (selectedLocationId) params.set("locationId", selectedLocationId);
    const res = await fetch(`/api/scans/latest?${params}`);
    const json = await res.json();
    onKeywordChange(keywordId, json.scan?.id ?? null);
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
            gridSize,
            radiusMeters,
            device,
            os,
            browser,
            locationId: selectedLocationId,
            ...scanRunExtras,
            ...extras,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Scan failed to start");
        onScanStarted?.(json.scan.id);
        onKeywordChange(selected.id, json.scan.id);
        void loadKeywords();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Run failed");
      } finally {
        setRunning(false);
      }
    },
    [
      selected,
      businessId,
      gridSize,
      radiusMeters,
      device,
      os,
      browser,
      selectedLocationId,
      scanRunExtras,
      onScanStarted,
      onKeywordChange,
      loadKeywords,
    ]
  );

  useImperativeHandle(ref, () => ({ runScan: runScanForKeyword, running }), [
    runScanForKeyword,
    running,
  ]);

  async function addKeyword() {
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
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Add failed");
    } finally {
      setAdding(false);
    }
  }

  const radiusMiles = Math.round(radiusMeters / 1609.344);
  const gridPoints = gridSize * gridSize;

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className={cn(
          "mb-4 flex w-full items-center justify-between rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-text-muted shadow-sm hover:bg-surface-subtle",
          className
        )}
      >
        <span>
          {selected?.keyword ?? "Keyword"} · {gridSize}×{gridSize} · {radiusMiles} mi
        </span>
        <SlidersHorizontal className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className={cn(gridRankCardClass, "mb-3 px-3 py-2.5", className)}>
      <div className="flex flex-col gap-2 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1 xl:max-w-[26%]">
          <label className={fieldLabel}>Keyword</label>
          {loading ? (
            <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
            </div>
          ) : (
            <select
              value={selectedKeywordId ?? selected?.id ?? ""}
              onChange={(e) => void handleSelect(e.target.value)}
              className={fieldSelect}
            >
              {keywords.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.keyword}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="min-w-0 flex-1 xl:max-w-[26%]">
          <LocationSwitcher
            businessId={businessId}
            keywordId={selectedKeywordId ?? selected?.id ?? null}
            gridSize={gridSize}
            radiusMeters={radiusMeters}
            selectedLocationId={selectedLocationId}
            onLocationChange={onLocationChange}
            compact
          />
        </div>

        <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-5">
          {[
            { label: "Grid", value: `${gridSize}×${gridSize} (${gridPoints} pts)` },
            { label: "Radius", value: `${radiusMiles} miles` },
            { label: "Device", value: device },
            { label: "OS", value: os },
            { label: "Browser", value: browser },
          ].map((item) => (
            <div key={item.label}>
              <label className="text-[9px] font-semibold uppercase tracking-wide text-zinc-500">
                {item.label}
              </label>
              <div className={cn(fieldSelect, "mt-0.5 cursor-default bg-zinc-50 capitalize")}>
                {item.value}
              </div>
            </div>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-0.5 self-end pb-0.5">
          <button
            type="button"
            onClick={() => setShowAddKeyword((v) => !v)}
            className="rounded p-1 text-zinc-500 hover:bg-zinc-100"
            title="Add keyword"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            className={cn(
              "rounded p-1 hover:bg-zinc-100",
              settingsOpen ? "text-[#137752]" : "text-zinc-500"
            )}
            title="Scan settings"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="rounded p-1 text-zinc-500 hover:bg-zinc-100"
            title="Collapse"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {selected && (
        <p className="mt-1.5 truncate text-[11px] text-zinc-500">
          {selected.lastScannedAt ? (
            <>Last scanned: {new Date(selected.lastScannedAt).toLocaleString()}</>
          ) : (
            <span className="text-amber-600">No scan yet</span>
          )}
          {selected.solv != null && <> · SoLV: {selected.solv}%</>}
          {selected.latestRank != null && (
            <> · Avg rank: #{rankLabel(Math.round(selected.latestRank))}</>
          )}
        </p>
      )}

      {showAddKeyword && (
        <div className="mt-2 flex gap-2 border-t border-border pt-2">
          <input
            type="text"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            placeholder="Add keyword…"
            className="flex-1 rounded-md border border-border px-2.5 py-1.5 text-sm"
            onKeyDown={(e) => e.key === "Enter" && void addKeyword()}
          />
          <button
            type="button"
            disabled={adding || !newKeyword.trim()}
            onClick={() => void addKeyword()}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-50"
          >
            {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}
          </button>
        </div>
      )}

      {settingsOpen && (
        <div className="mt-2 border-t border-zinc-100 pt-2 text-[11px] text-zinc-500">
          Scan profile: {gridPoints} points · {radiusMiles} mi radius
        </div>
      )}

      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
});
