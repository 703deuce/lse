"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Grid3X3, Info, Loader2, Play, Plus, RotateCcw, Search } from "lucide-react";
import { GridPreviewCanvas } from "@/components/scan/grid-preview-canvas";
import {
  dashboardCard,
  dashboardCardTitle,
  dashboardControl,
  dashboardMicro,
} from "@/components/overview/dashboard-ui";
import { StatusBadge } from "@/components/ui/metric-card";
import { EmptyState } from "@/components/ui/design-system";
import {
  DEFAULT_GRID_SIZE,
  DEFAULT_RADIUS_METERS,
  GRID_SIZE_OPTIONS,
  computeSolv,
} from "@/lib/maps/grid-metrics";
import { DEFAULT_SCAN_PROFILE } from "@/lib/maps/scan-profiles";
import {
  DEFAULT_MAPS_PROVIDER_MODE,
  MAPS_PROVIDER_MODE_OPTIONS,
  type MapsProviderMode,
} from "@/lib/maps/provider-modes";
import {
  DEFAULT_MAPS_LOCATION_ZOOM,
  MAPS_ZOOM_OPTIONS,
  mapsZoomLabel,
} from "@/lib/maps/maps-zoom";
import { RadiusMilesField } from "@/components/scan/radius-miles-field";
import { updateBusinessSettings } from "@/lib/actions/mutations";
import { cn } from "@/lib/utils";
import type { KeywordOption, ScanListItem } from "@/components/scan/scans-hub-types";

const fieldLabel = "text-[10px] font-semibold uppercase tracking-wide text-zinc-500";
const fieldSelect = cn(dashboardControl, "mt-1 h-auto w-full px-2.5 py-1.5");
const accordionBtn =
  "flex w-full items-center justify-between px-3.5 py-2.5 text-left text-[13px] font-semibold text-zinc-900 hover:bg-zinc-50";

function formatScanDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRadius(meters: number): string {
  const miles = meters / 1609.34;
  return miles >= 1 ? `${Math.round(miles * 10) / 10} mi` : `${meters} m`;
}

/**
 * BrightLocal-style Local Search Grid setup:
 * left config panel + right live map preview with clickable bubbles.
 * Scan does NOT start until the user clicks Run Scan.
 */
export function ScanSetupStudio({
  businessId,
  scans,
  keywords,
  defaultCenterLat,
  defaultCenterLng,
  defaultAddress,
  businessName,
}: {
  businessId: string;
  scans: ScanListItem[];
  keywords: KeywordOption[];
  defaultCenterLat: number;
  defaultCenterLng: number;
  defaultAddress?: string | null;
  businessName?: string;
}) {
  const router = useRouter();
  const [accountAddress, setAccountAddress] = useState((defaultAddress ?? "").trim());
  const [openSection, setOpenSection] = useState<"location" | "keywords" | "general">("location");
  const [keywordFilter, setKeywordFilter] = useState<string>("all");
  const [selectedKeywordId, setSelectedKeywordId] = useState(
    keywords.find((k) => k.is_primary)?.id ?? keywords[0]?.id ?? ""
  );
  const [selectedKeywordIds, setSelectedKeywordIds] = useState<string[]>(() => {
    const primary = keywords.find((k) => k.is_primary)?.id ?? keywords[0]?.id;
    return primary ? [primary] : [];
  });
  const [gridSize, setGridSize] = useState(DEFAULT_GRID_SIZE);
  const [radiusMeters, setRadiusMeters] = useState(DEFAULT_RADIUS_METERS);
  const [mapsProviderMode, setMapsProviderMode] = useState<MapsProviderMode>(
    DEFAULT_MAPS_PROVIDER_MODE
  );
  const [locationZoom, setLocationZoom] = useState(DEFAULT_MAPS_LOCATION_ZOOM);
  const [centerLat, setCenterLat] = useState(defaultCenterLat);
  const [centerLng, setCenterLng] = useState(defaultCenterLng);
  const [defaultLat, setDefaultLat] = useState(defaultCenterLat);
  const [defaultLng, setDefaultLng] = useState(defaultCenterLng);
  const [locationLabel, setLocationLabel] = useState(accountAddress || "Account location");
  const [locationQuery, setLocationQuery] = useState(accountAddress);
  const [usingAccountLocation, setUsingAccountLocation] = useState(true);
  const [geocoding, setGeocoding] = useState(false);
  const [excludedLabels, setExcludedLabels] = useState<Set<string>>(() => new Set());
  const [newKeyword, setNewKeyword] = useState("");
  const [showAddKeyword, setShowAddKeyword] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset exclusions when grid geometry changes
  useEffect(() => {
    setExcludedLabels(new Set());
  }, [gridSize, radiusMeters, centerLat, centerLng]);

  useEffect(() => {
    const nextAddress = (defaultAddress ?? "").trim();
    setAccountAddress(nextAddress);
    setDefaultLat(defaultCenterLat);
    setDefaultLng(defaultCenterLng);
    setCenterLat(defaultCenterLat);
    setCenterLng(defaultCenterLng);
    setLocationLabel(nextAddress || "Account location");
    setLocationQuery(nextAddress);
    setUsingAccountLocation(true);
  }, [defaultCenterLat, defaultCenterLng, defaultAddress]);

  const totalPoints = gridSize * gridSize;
  const includedCount = totalPoints - excludedLabels.size;
  const selectedKeyword = keywords.find((k) => k.id === selectedKeywordId);

  const filteredScans = useMemo(() => {
    if (keywordFilter === "all") return scans;
    return scans.filter((s) => s.keyword_id === keywordFilter);
  }, [scans, keywordFilter]);

  function toggleLabel(label: string) {
    setExcludedLabels((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      if (next.size >= totalPoints) return prev;
      return next;
    });
  }

  function resetToAccountLocation() {
    setCenterLat(defaultLat);
    setCenterLng(defaultLng);
    setLocationLabel(accountAddress || "Account location");
    setLocationQuery(accountAddress);
    setUsingAccountLocation(true);
    setError(null);
  }

  async function applyLocationFromAddress() {
    const q = locationQuery.trim();
    if (!q) {
      setError("Enter an address, or a city and state.");
      return;
    }
    // Same text as account default → restore without re-geocoding
    if (accountAddress && q.toLowerCase() === accountAddress.toLowerCase()) {
      resetToAccountLocation();
      return;
    }
    setGeocoding(true);
    setError(null);
    try {
      const res = await fetch("/api/scans/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: q }),
      });
      const json = (await res.json()) as {
        error?: string;
        lat?: number;
        lng?: number;
        label?: string;
        displayName?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Could not find that location");
      if (json.lat == null || json.lng == null) throw new Error("Could not find that location");
      const label = json.displayName ?? json.label ?? q;
      setCenterLat(json.lat);
      setCenterLng(json.lng);
      setLocationLabel(label);
      // Persist as the location's private scan center so service-area businesses
      // don't re-enter this on every scan.
      await updateBusinessSettings(businessId, {
        scan_center_lat: json.lat,
        scan_center_lng: json.lng,
        scan_center_label: label,
      });
      setAccountAddress(label);
      setDefaultLat(json.lat);
      setDefaultLng(json.lng);
      setUsingAccountLocation(true);
      setOpenSection("general");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not find that location");
    } finally {
      setGeocoding(false);
    }
  }

  async function runScan(keywordId: string) {
    const ids =
      selectedKeywordIds.length > 0
        ? selectedKeywordIds
        : keywordId
          ? [keywordId]
          : [];
    if (!ids.length) {
      setError("Select at least one keyword.");
      return;
    }
    if (includedCount < 1) {
      setError("Include at least one grid point before running.");
      return;
    }
    if (ids.length > 1) {
      const ok = confirm(
        `This will create ${ids.length} background scans (one per keyword). Continue?`
      );
      if (!ok) return;
    }
    setRunning(true);
    setError(null);
    try {
      for (const id of ids) {
        const res = await fetch("/api/scans/run-for-keyword", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessId,
            keywordId: id,
            gridSize,
            radiusMeters,
            device: DEFAULT_SCAN_PROFILE.device,
            os: DEFAULT_SCAN_PROFILE.os,
            browser: DEFAULT_SCAN_PROFILE.browser,
            mapsProviderMode,
            locationZoom,
            centerLat,
            centerLng,
            centerLabel: locationLabel,
            excludedLabels: [...excludedLabels],
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Scan failed to start");
      }
      // Must leave setup immediately — scan runs in the worker.
      const { goToDashboardAfterScanStart } = await import("@/lib/scans/after-scan-start");
      goToDashboardAfterScanStart(businessId);
      return;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setRunning(false);
    }
  }

  function toggleKeywordSelection(id: string) {
    setSelectedKeywordIds((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((x) => x !== id);
        if (selectedKeywordId === id && next[0]) setSelectedKeywordId(next[0]);
        return next;
      }
      setSelectedKeywordId(id);
      return [...prev, id];
    });
  }

  async function addKeyword() {
    const trimmed = newKeyword.trim();
    if (!trimmed) return;
    setRunning(true);
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
      if (json.keyword?.id) {
        setSelectedKeywordId(json.keyword.id);
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Add failed");
    } finally {
      setRunning(false);
    }
  }

  function Section({
    id,
    title,
    children,
  }: {
    id: "location" | "keywords" | "general";
    title: string;
    children: ReactNode;
  }) {
    const open = openSection === id;
    return (
      <div className="border-b border-zinc-100 last:border-b-0">
        <button
          type="button"
          className={accordionBtn}
          onClick={() => setOpenSection(open ? "general" : id)}
          aria-expanded={open}
        >
          <span>{title}</span>
          <span className="text-zinc-400">{open ? "▾" : "▸"}</span>
        </button>
        {open && <div className="space-y-3 px-3.5 pb-3.5">{children}</div>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:grid lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
        {/* Left config panel */}
        <aside className="border-b border-zinc-200 lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-2 border-b border-zinc-100 px-3.5 py-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <Grid3X3 className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-[14px] font-bold text-zinc-900">Local Search Grid</h2>
              <p className={dashboardMicro}>{businessName ?? "Configure then preview"}</p>
            </div>
          </div>

          <Section id="location" title="Location and business details">
            <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Active scan center
              </p>
              <p className="mt-0.5 text-[13px] font-medium leading-snug text-zinc-900">
                {locationLabel}
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                {accountAddress
                  ? usingAccountLocation
                    ? "Using your saved scan-center address"
                    : "Updating saved scan center"
                  : "No saved address yet — add one below (common for service-area listings)"}
              </p>
            </div>

            {!accountAddress ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] leading-relaxed text-amber-900">
                This location has no public Google address. Set a private scan center once — we save
                it on the location so you don&apos;t re-enter it every scan.
              </p>
            ) : null}

            <label className={fieldLabel}>
              Address or city &amp; state
              <input
                type="text"
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void applyLocationFromAddress();
                  }
                }}
                placeholder='e.g. "Woodbridge, VA" or full street address'
                className={fieldSelect}
              />
            </label>
            <p className="text-[11px] leading-relaxed text-zinc-500">
              Type an address or city and state — we set the map pin and save it to this location.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={geocoding || !locationQuery.trim()}
                onClick={() => void applyLocationFromAddress()}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-zinc-900 px-2.5 py-1.5 text-[12px] font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                {geocoding ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Search className="h-3.5 w-3.5" />
                )}
                Update map
              </button>
              {!usingAccountLocation && (
                <button
                  type="button"
                  onClick={resetToAccountLocation}
                  className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-[12px] font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Account default
                </button>
              )}
            </div>
          </Section>

          <Section id="keywords" title="Keywords">
            <p className="text-[11px] text-zinc-500">
              Select one or more keywords. Each keyword becomes its own background scan.
            </p>
            <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto">
              {keywords.map((k) => {
                const checked = selectedKeywordIds.includes(k.id);
                return (
                  <li key={k.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-[13px] hover:bg-zinc-50">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleKeywordSelection(k.id)}
                      />
                      <span className="font-medium text-zinc-900">{k.keyword}</span>
                      {k.is_primary ? (
                        <span className="text-[10px] uppercase text-zinc-400">Primary</span>
                      ) : null}
                    </label>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              onClick={() => setShowAddKeyword((v) => !v)}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-emerald-700 hover:underline"
            >
              <Plus className="h-3.5 w-3.5" />
              Add keyword
            </button>
            {showAddKeyword && (
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  placeholder='e.g. "junk removal woodbridge"'
                  className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-[13px]"
                />
                <button
                  type="button"
                  disabled={running || !newKeyword.trim()}
                  onClick={() => void addKeyword()}
                  className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-[12px] font-medium disabled:opacity-50"
                >
                  Save keyword
                </button>
              </div>
            )}
          </Section>

          <Section id="general" title="General settings">
            <div>
              <p className={fieldLabel}>Presets</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {(
                  [
                    { label: "Quick", size: 5 },
                    { label: "Standard", size: 7 },
                    { label: "Detailed", size: 9 },
                  ] as const
                ).map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setGridSize(preset.size)}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-[12px] font-medium",
                      gridSize === preset.size
                        ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                        : "border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                    )}
                  >
                    {preset.label} · {preset.size}×{preset.size}
                  </button>
                ))}
              </div>
            </div>
            <label className={fieldLabel}>
              Grid size
              <select
                value={gridSize}
                onChange={(e) => setGridSize(Number(e.target.value))}
                className={fieldSelect}
              >
                {GRID_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}×{n} ({n * n} cells)
                  </option>
                ))}
              </select>
            </label>
            <RadiusMilesField
              valueMeters={radiusMeters}
              onChangeMeters={setRadiusMeters}
              labelClassName={fieldLabel}
              selectClassName={fieldSelect}
              inputClassName={cn(dashboardControl, "h-auto w-full px-2.5 py-1.5")}
            />
            <label className={fieldLabel}>
              Maps provider
              <select
                value={mapsProviderMode}
                onChange={(e) => setMapsProviderMode(e.target.value as MapsProviderMode)}
                className={fieldSelect}
                title={
                  MAPS_PROVIDER_MODE_OPTIONS.find((o) => o.id === mapsProviderMode)?.description
                }
              >
                {MAPS_PROVIDER_MODE_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={fieldLabel}>
              Map zoom
              <select
                value={locationZoom}
                onChange={(e) => setLocationZoom(Number(e.target.value))}
                className={fieldSelect}
                title="Production default is 14 (Falcon match). Higher = tighter neighborhood."
              >
                {MAPS_ZOOM_OPTIONS.map((z) => (
                  <option key={z} value={z}>
                    {mapsZoomLabel(z)}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-[11px] leading-relaxed text-zinc-500">
              A/B provider and zoom (default 14 / Falcon match). Radius is center → outer edge.
            </p>
            <div className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-[12px] leading-relaxed text-sky-900">
              <p className="flex gap-1.5">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Click bubbles on the map to exclude empty areas before you run — excluded cells are
                  skipped and do not affect metrics.
                </span>
              </p>
            </div>
            <p className="text-[12px] text-zinc-600">
              Keywords:{" "}
              <strong>
                {selectedKeywordIds.length > 1
                  ? `${selectedKeywordIds.length} selected`
                  : selectedKeyword?.keyword ?? "—"}
              </strong>
              <br />
              Grid: <strong>{includedCount}</strong> of {totalPoints} cells
              {excludedLabels.size > 0 ? ` (${excludedLabels.size} excluded)` : ""}.
            </p>
          </Section>

          <div className="space-y-2 border-t border-zinc-100 p-3.5">
            {error && <p className="text-[12px] text-red-600">{error}</p>}
            <button
              type="button"
              disabled={
                running ||
                geocoding ||
                selectedKeywordIds.length < 1 ||
                includedCount < 1
              }
              onClick={() => void runScan(selectedKeywordId)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#137752] px-3.5 py-2.5 text-[13px] font-semibold text-white hover:bg-[#0f6244] disabled:opacity-50"
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {selectedKeywordIds.length > 1
                ? `Run ${selectedKeywordIds.length} scans · ${includedCount} cells each`
                : `Run scan · ${includedCount} cells`}
            </button>
            <p className="text-center text-[11px] text-zinc-400">
              Manual Maps scans are unlimited. The scan continues in the background after you start.
            </p>
          </div>
        </aside>

        {/* Right preview — live map */}
        <div className="bg-zinc-50/80 p-3 sm:p-4">
          <GridPreviewCanvas
            centerLat={centerLat}
            centerLng={centerLng}
            gridSize={gridSize}
            radiusMeters={radiusMeters}
            excludedLabels={excludedLabels}
            onToggleLabel={toggleLabel}
            locationLabel={locationLabel}
          />
          {excludedLabels.size > 0 && (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[12px] text-zinc-600">
              <span>{excludedLabels.size} point(s) excluded</span>
              <button
                type="button"
                className="font-medium text-emerald-700 hover:underline"
                onClick={() => setExcludedLabels(new Set())}
              >
                Reset all points
              </button>
            </div>
          )}
        </div>
      </div>

      {/* History */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className={dashboardCardTitle}>Scan history</h2>
          <p className={dashboardMicro}>{filteredScans.length} scan(s)</p>
        </div>
        <select
          value={keywordFilter}
          onChange={(e) => setKeywordFilter(e.target.value)}
          className={cn(dashboardControl, "h-auto px-2.5 py-1.5")}
        >
          <option value="all">All keywords</option>
          {keywords.map((k) => (
            <option key={k.id} value={k.id}>
              {k.keyword}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        {filteredScans.map((scan) => {
          const metrics = scan.aggregate_metrics ?? {};
          const solv =
            metrics.top3Cells != null && metrics.totalCells
              ? computeSolv(metrics.top3Cells, metrics.totalCells)
              : null;
          return (
            <Link
              key={scan.id}
              href={`/businesses/${businessId}/grid/${scan.id}`}
              className={cn(
                dashboardCard,
                "block p-3 transition hover:border-emerald-200 hover:shadow-md"
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold text-zinc-900">
                    {scan.keyword ? `“${scan.keyword}”` : "Unknown keyword"}
                  </p>
                  <p className="mt-0.5 text-[12px] text-zinc-600">
                    {scan.grid_size}×{scan.grid_size} grid · {formatRadius(scan.radius_meters)} radius
                    {scan.center_label ? ` · ${scan.center_label}` : ""}
                  </p>
                  <p className="mt-0.5 text-[11px] text-zinc-500">
                    {formatScanDate(scan.finished_at ?? scan.created_at)}
                    {metrics.averageRank != null && <> · Avg rank {metrics.averageRank}</>}
                    {solv != null && <> · SoLV {solv}%</>}
                  </p>
                </div>
                <StatusBadge status={scan.status} />
              </div>
            </Link>
          );
        })}
        {!filteredScans.length && (
          <EmptyState
            title="No scans yet"
            description="Set your location and grid on the left, exclude unused bubbles on the map, then run your first scan."
          />
        )}
      </div>
    </div>
  );
}
