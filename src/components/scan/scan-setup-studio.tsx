"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bookmark,
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  Eye,
  Grid3X3,
  History,
  Info,
  Loader2,
  MapPin,
  Play,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { GridPreviewCanvas } from "@/components/scan/grid-preview-canvas";
import {
  DEFAULT_GRID_SIZE,
  DEFAULT_RADIUS_METERS,
  GRID_SIZE_OPTIONS,
  formatRadiusMiles,
  metersToMiles,
  milesToMeters,
  nearestRadiusMileOption,
  RADIUS_MILE_OPTIONS,
} from "@/lib/maps/grid-metrics";
import { DEFAULT_SCAN_PROFILE } from "@/lib/maps/scan-profiles";
import { DEFAULT_MAPS_PROVIDER_MODE } from "@/lib/maps/provider-modes";
import {
  DEFAULT_DFS_EXECUTION_MODE,
  DFS_EXECUTION_MODE_OPTIONS,
  osForScanDevice,
  type DfsExecutionMode,
} from "@/lib/maps/dfs-execution-modes";
import {
  DEFAULT_MAPS_LOCATION_ZOOM,
  MAPS_ZOOM_OPTIONS,
  mapsZoomLabel,
} from "@/lib/maps/maps-zoom";
import { updateBusinessSettings } from "@/lib/actions/mutations";
import { cn } from "@/lib/utils";
import type { KeywordOption, ScanListItem } from "@/components/scan/scans-hub-types";
import { customerSafeScanError } from "@/lib/scans/customer-safe-error";
import { mock } from "@/components/mockup/ui";

const fieldLabel = mock.label;
const fieldControl =
  "mt-1.5 h-10 w-full rounded-lg border border-[#E6EAF0] bg-white px-3 text-sm text-[#101828] shadow-sm outline-none transition focus:border-[#137752] focus:ring-1 focus:ring-[#137752]/25";

function formatScanDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
  });
}

function formatVolume(value: number | null | undefined): string {
  if (value == null) return "—";
  if (value >= 1000) return `${Math.round(value / 100) / 10}k`;
  return String(value);
}

function formatAvgRank(value: number | null | undefined): string {
  if (value == null) return "—";
  return String(Math.round(value * 10) / 10);
}

function ChangeBadge({ value }: { value: number | null | undefined }) {
  if (value == null || value === 0) return <span className="text-[#98A2B3]">—</span>;
  const positive = value > 0;
  return (
    <span
      className={cn(
        "font-semibold tabular-nums",
        positive ? "text-[#027A48]" : "text-[#B42318]"
      )}
    >
      {positive ? "+" : ""}
      {value}
    </span>
  );
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
  const [openSections, setOpenSections] = useState<Record<"location" | "keywords" | "general", boolean>>({
    location: true,
    keywords: false,
    general: true,
  });
  const [selectedKeywordId, setSelectedKeywordId] = useState(
    keywords.find((k) => k.is_primary)?.id ?? keywords[0]?.id ?? ""
  );
  const [selectedKeywordIds, setSelectedKeywordIds] = useState<string[]>(() => {
    const primary = keywords.find((k) => k.is_primary)?.id ?? keywords[0]?.id;
    return primary ? [primary] : [];
  });
  const [gridSize, setGridSize] = useState(DEFAULT_GRID_SIZE);
  const [radiusMeters, setRadiusMeters] = useState(DEFAULT_RADIUS_METERS);
  const [locationZoom, setLocationZoom] = useState(DEFAULT_MAPS_LOCATION_ZOOM);
  const [device, setDevice] = useState<"desktop" | "mobile">(DEFAULT_SCAN_PROFILE.device);
  const [dfsExecutionMode, setDfsExecutionMode] = useState<DfsExecutionMode>(
    DEFAULT_DFS_EXECUTION_MODE
  );
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
  const radiusMiles = nearestRadiusMileOption(radiusMeters);
  void scans;

  function toggleSection(id: "location" | "keywords" | "general") {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  }

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

  function resetSetup() {
    setGridSize(DEFAULT_GRID_SIZE);
    setRadiusMeters(DEFAULT_RADIUS_METERS);
    setLocationZoom(DEFAULT_MAPS_LOCATION_ZOOM);
    setDevice(DEFAULT_SCAN_PROFILE.device);
    setDfsExecutionMode(DEFAULT_DFS_EXECUTION_MODE);
    setExcludedLabels(new Set());
    resetToAccountLocation();
  }

  async function applyLocationFromAddress() {
    const q = locationQuery.trim();
    if (!q) {
      setError("Enter an address, or a city and state.");
      return;
    }
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
      await updateBusinessSettings(businessId, {
        scan_center_lat: json.lat,
        scan_center_lng: json.lng,
        scan_center_label: label,
      });
      setAccountAddress(label);
      setDefaultLat(json.lat);
      setDefaultLng(json.lng);
      setUsingAccountLocation(true);
      setOpenSections((s) => ({ ...s, general: true }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not find that location");
    } finally {
      setGeocoding(false);
    }
  }

  async function runScan(keywordId: string) {
    const ids =
      selectedKeywordIds.length > 0 ? selectedKeywordIds : keywordId ? [keywordId] : [];
    if (!ids.length) {
      setError("Select at least one keyword.");
      return;
    }
    if (includedCount < 1) {
      setError("Include at least one grid point before running.");
      return;
    }
    if (
      !Number.isFinite(centerLat) ||
      !Number.isFinite(centerLng) ||
      (centerLat === 0 && centerLng === 0)
    ) {
      setError("Set a scan center before running a Maps scan.");
      setOpenSections((s) => ({ ...s, location: true }));
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
            device,
            os: osForScanDevice(device),
            browser: DEFAULT_SCAN_PROFILE.browser,
            mapsProviderMode: DEFAULT_MAPS_PROVIDER_MODE,
            dfsExecutionMode,
            locationZoom,
            centerLat,
            centerLng,
            centerLabel: locationLabel,
            excludedLabels: [...excludedLabels],
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          const safe = customerSafeScanError(json.error);
          throw new Error(
            safe ??
              "We couldn't start the scan. Check the keyword and scan center, then try again."
          );
        }
      }
      const { goToDashboardAfterScanStart } = await import("@/lib/scans/after-scan-start");
      goToDashboardAfterScanStart(businessId);
      return;
    } catch (e) {
      setError(
        customerSafeScanError(e instanceof Error ? e.message : String(e)) ?? "Scan failed"
      );
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
        setSelectedKeywordIds((prev) =>
          prev.includes(json.keyword.id) ? prev : [...prev, json.keyword.id]
        );
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Add failed");
    } finally {
      setRunning(false);
    }
  }

  async function removeKeyword(keywordId: string) {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/scans/keywords/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, keywordId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Could not remove keyword");
      setSelectedKeywordIds((prev) => prev.filter((id) => id !== keywordId));
      if (selectedKeywordId === keywordId) {
        const next = keywords.find((k) => k.id !== keywordId)?.id ?? "";
        setSelectedKeywordId(next);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove keyword");
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
    const open = openSections[id];
    return (
      <div className="border-b border-[#F2F4F7] last:border-b-0">
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-[#101828] hover:bg-[#F9FAFB]"
          onClick={() => toggleSection(id)}
          aria-expanded={open}
        >
          <span>{title}</span>
          {open ? (
            <ChevronDown className="h-4 w-4 text-[#98A2B3]" />
          ) : (
            <ChevronRight className="h-4 w-4 text-[#98A2B3]" />
          )}
        </button>
        {open && <div className="space-y-3 px-4 pb-4">{children}</div>}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-[28px] font-bold tracking-tight text-[#101828]">
            <MapPin className="h-6 w-6 text-[#137752]" />
            Maps Scans
          </h1>
          <p className="mt-1 text-sm text-[#667085]">
            Configure your local search grid, exclude unused points, then run a scan to see how you
            rank in the map pack.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={mock.btnSecondary} onClick={resetSetup}>
            <Bookmark className="h-4 w-4" />
            Save template
          </button>
          <button
            type="button"
            className={mock.btnSecondary}
            onClick={() => setOpenSections({ location: true, keywords: true, general: true })}
          >
            <Eye className="h-4 w-4" />
            Preview
          </button>
          <button type="button" className={mock.btnSecondary} onClick={resetSetup}>
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
          <Link href="/scans" className={mock.btnSecondary}>
            <History className="h-4 w-4" />
            History
          </Link>
          <button type="button" className={mock.btnSecondary}>
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      <div className={cn(mock.card, "overflow-hidden lg:grid lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]")}>
        <aside className="border-b border-[#E6EAF0] lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-2.5 border-b border-[#F2F4F7] px-4 py-3.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ECFDF3] text-[#137752]">
              <Grid3X3 className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-[#101828]">Local Search Grid</h2>
              <p className="truncate text-xs text-[#667085]">{businessName ?? "Configure then preview"}</p>
            </div>
          </div>

          <Section id="location" title="Location and business details">
            <div className="rounded-xl border border-[#E6EAF0] bg-[#F9FAFB] px-3 py-2.5">
              <p className={fieldLabel}>Active scan center</p>
              <div className="mt-1.5 flex items-start gap-2">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#137752]" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-snug text-[#101828]">{locationLabel}</p>
                  <p className="mt-0.5 text-[12px] text-[#667085]">
                    {accountAddress
                      ? usingAccountLocation
                        ? "Using your saved scan-center address"
                        : "Updating saved scan center"
                      : "No saved address yet — add one below (common for service-area listings)"}
                  </p>
                </div>
              </div>
            </div>

            {!accountAddress ? (
              <p className="rounded-lg border border-[#FEDF89] bg-[#FFFAEB] px-3 py-2 text-[12px] leading-relaxed text-[#93370D]">
                This location has no public Google address. Set a private scan center once — we save
                it on the location so you don&apos;t re-enter it every scan.
              </p>
            ) : null}

            <label className="block">
              <span className={fieldLabel}>Address or city &amp; state</span>
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
                className={fieldControl}
              />
            </label>
            <p className="text-[12px] leading-relaxed text-[#667085]">
              Type an address or city and state — we set the map pin and save it to this location.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={geocoding || !locationQuery.trim()}
                onClick={() => void applyLocationFromAddress()}
                className={cn(mock.btnSecondary, "flex-1 disabled:opacity-50")}
              >
                {geocoding ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <MapPin className="h-3.5 w-3.5" />
                )}
                Update map
              </button>
              {!usingAccountLocation && (
                <button type="button" onClick={resetToAccountLocation} className={mock.btnSecondary}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Account default
                </button>
              )}
            </div>
          </Section>

          <Section id="keywords" title="Keywords">
            <p className="text-[12px] text-[#667085]">
              Select one or more Maps keywords. Each selected keyword becomes its own background
              scan.
            </p>
            <div className="mt-1 overflow-hidden rounded-xl border border-[#E6EAF0]">
              <div className="grid grid-cols-[minmax(92px,1fr)_42px_54px_48px_38px_26px] gap-1.5 bg-[#F9FAFB] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#98A2B3]">
                <span>Keyword</span>
                <span>Volume</span>
                <span>Last scan</span>
                <span>Avg rank</span>
                <span>Change</span>
                <span className="sr-only">Remove</span>
              </div>
              <ul className="max-h-60 divide-y divide-[#F2F4F7] overflow-y-auto">
                {keywords.map((k) => {
                  const checked = selectedKeywordIds.includes(k.id);
                  return (
                    <li
                      key={k.id}
                      className={cn(
                        "grid grid-cols-[minmax(92px,1fr)_42px_54px_48px_38px_26px] items-center gap-1.5 px-3 py-2.5 text-[12px]",
                        checked ? "bg-[#ECFDF3]/70" : "bg-white hover:bg-[#F9FAFB]"
                      )}
                    >
                      <label className="flex min-w-0 cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleKeywordSelection(k.id)}
                          className="rounded border-[#D0D5DD] text-[#137752] focus:ring-[#137752]"
                        />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-[#101828]">{k.keyword}</span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-[#98A2B3]">
                            {k.is_primary ? <span>Primary</span> : null}
                            {k.latest_center_label ? (
                              <span className="truncate">{k.latest_center_label}</span>
                            ) : null}
                            {k.latest_scan_id ? (
                              <Link
                                href={`/businesses/${businessId}/grid/${k.latest_scan_id}`}
                                className="inline-flex items-center gap-0.5 text-[#137752] hover:underline"
                              >
                                Open grid
                                <ExternalLink className="h-2.5 w-2.5" />
                              </Link>
                            ) : null}
                          </span>
                        </span>
                      </label>
                      <span className="tabular-nums text-[#475467]">{formatVolume(k.search_volume)}</span>
                      <span className="tabular-nums text-[#667085]">
                        {k.last_scan_at ? formatScanDate(k.last_scan_at) : "—"}
                      </span>
                      <span className="tabular-nums font-medium text-[#101828]">
                        {formatAvgRank(k.latest_average_rank)}
                      </span>
                      <span className="text-[11px]">
                        <ChangeBadge value={k.change} />
                      </span>
                      <button
                        type="button"
                        disabled={running}
                        onClick={() => void removeKeyword(k.id)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#98A2B3] hover:bg-[#FEF3F2] hover:text-[#B42318] disabled:opacity-50"
                        aria-label={`Remove ${k.keyword}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  );
                })}
                {!keywords.length ? (
                  <li className="px-3 py-3 text-[12px] text-[#667085]">
                    Add a keyword to start tracking Maps scans for this location.
                  </li>
                ) : null}
              </ul>
            </div>
            <button
              type="button"
              onClick={() => setShowAddKeyword((v) => !v)}
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#137752] hover:underline"
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
                  className={fieldControl}
                />
                <button
                  type="button"
                  disabled={running || !newKeyword.trim()}
                  onClick={() => void addKeyword()}
                  className={cn(mock.btnSecondary, "disabled:opacity-50")}
                >
                  Save keyword
                </button>
              </div>
            )}
          </Section>

          <Section id="general" title="General settings">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={fieldLabel}>Grid size</span>
                <select
                  value={gridSize}
                  onChange={(e) => setGridSize(Number(e.target.value))}
                  className={fieldControl}
                >
                  {GRID_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n} × {n} ({n * n} cells)
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={fieldLabel}>Spacing</span>
                <select
                  value={radiusMiles}
                  onChange={(e) => setRadiusMeters(milesToMeters(Number(e.target.value)))}
                  className={fieldControl}
                >
                  {RADIUS_MILE_OPTIONS.filter((m) => m === 0.5 || m === 1 || m === 2 || m === 5 || m === 10 || m === 25 || m % 5 === 0).map(
                    (m) => (
                      <option key={m} value={m}>
                        {formatRadiusMiles(m)}
                        {m === 5 ? " — recommended" : ""}
                      </option>
                    )
                  )}
                </select>
              </label>
              <label className="block">
                <span className={fieldLabel}>Search term</span>
                <select
                  value={selectedKeywordId}
                  onChange={(e) => {
                    setSelectedKeywordId(e.target.value);
                    if (e.target.value && !selectedKeywordIds.includes(e.target.value)) {
                      setSelectedKeywordIds((prev) => [...prev, e.target.value]);
                    }
                  }}
                  className={fieldControl}
                >
                  {keywords.length === 0 ? (
                    <option value="">No keywords yet</option>
                  ) : (
                    keywords.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.is_primary ? "Primary keyword" : k.keyword}
                        {k.is_primary ? ` · ${k.keyword}` : ""}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <label className="block">
                <span className={fieldLabel}>Scan type</span>
                <select
                  value={device}
                  onChange={(e) => setDevice(e.target.value as "desktop" | "mobile")}
                  className={fieldControl}
                >
                  <option value="desktop">Standard scan</option>
                  <option value="mobile">Mobile scan</option>
                </select>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={fieldLabel}>Map zoom</span>
                <select
                  value={locationZoom}
                  onChange={(e) => setLocationZoom(Number(e.target.value))}
                  className={fieldControl}
                >
                  {MAPS_ZOOM_OPTIONS.map((z) => (
                    <option key={z} value={z}>
                      {mapsZoomLabel(z)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={fieldLabel}>DataForSEO mode</span>
                <select
                  value={dfsExecutionMode}
                  onChange={(e) => setDfsExecutionMode(e.target.value as DfsExecutionMode)}
                  className={fieldControl}
                >
                  {DFS_EXECUTION_MODE_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <p className="flex items-start gap-2 text-[12px] leading-relaxed text-[#667085]">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1570EF]" />
              <span>
                Scanning Google Maps results for the selected search term. Click bubbles on the map
                to exclude empty areas before you run.
              </span>
            </p>
          </Section>

          <div className="space-y-2 border-t border-[#F2F4F7] p-4">
            {error && <p className="text-[12px] text-[#B42318]">{error}</p>}
            <button
              type="button"
              disabled={running || geocoding || selectedKeywordIds.length < 1 || includedCount < 1}
              onClick={() => void runScan(selectedKeywordId)}
              className={cn(mock.btnPrimary, "w-full disabled:opacity-50")}
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
              {selectedKeywordIds.length > 1
                ? `Run ${selectedKeywordIds.length} scans · ${includedCount} cells each`
                : `Run scan · ${includedCount} cells`}
            </button>
            <p className="text-center text-[12px] text-[#98A2B3]">
              Manual Maps scans are unlimited. The scan continues in the background after you start.
            </p>
          </div>
        </aside>

        <div className="bg-[#F9FAFB] p-3 sm:p-4">
          <GridPreviewCanvas
            centerLat={centerLat}
            centerLng={centerLng}
            gridSize={gridSize}
            radiusMeters={radiusMeters}
            excludedLabels={excludedLabels}
            onToggleLabel={toggleLabel}
            locationLabel={locationLabel}
            centerDetail={locationLabel}
            spacingMiles={metersToMiles(
              gridSize > 1 ? (2 * radiusMeters) / (gridSize - 1) : 0
            )}
          />
          {excludedLabels.size > 0 && (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[12px] text-[#667085]">
              <span>{excludedLabels.size} point(s) excluded</span>
              <button
                type="button"
                className="font-semibold text-[#137752] hover:underline"
                onClick={() => setExcludedLabels(new Set())}
              >
                Reset all points
              </button>
            </div>
          )}
          {selectedKeyword ? (
            <p className="mt-2 text-center text-[12px] text-[#667085]">
              Search term: <span className="font-semibold text-[#101828]">{selectedKeyword.keyword}</span>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
