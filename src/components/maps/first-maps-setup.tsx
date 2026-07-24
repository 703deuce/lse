"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Grid3X3,
  Loader2,
  MapPin,
  Plus,
  Search,
  Star,
  Trophy,
} from "lucide-react";
import {
  ModuleHeader,
  ModulePage,
  btnPrimary,
  btnSecondary,
  cardClass,
  cardPadding,
  fieldLabelClass,
  inputClass,
} from "@/components/ui/design-system";
import {
  DEFAULT_GRID_SIZE,
  DEFAULT_RADIUS_METERS,
  GRID_SIZE_OPTIONS,
  formatRadiusMiles,
  gridScanMeta,
  metersToMiles,
  milesToMeters,
  nearestRadiusMileOption,
  RADIUS_MILE_PRESETS,
} from "@/lib/maps/grid-metrics";
import { DEFAULT_SCAN_PROFILE } from "@/lib/maps/scan-profiles";
import { DEFAULT_MAPS_PROVIDER_MODE } from "@/lib/maps/provider-modes";
import {
  DEFAULT_DFS_EXECUTION_MODE,
  osForScanDevice,
} from "@/lib/maps/dfs-execution-modes";
import { DEFAULT_MAPS_LOCATION_ZOOM } from "@/lib/maps/maps-zoom";
import { updateBusinessSettings } from "@/lib/actions/mutations";
import { customerSafeScanError } from "@/lib/scans/customer-safe-error";
import { isMapRenderable, SCAN_POLL_STATUSES } from "@/lib/scans/status";
import { cn } from "@/lib/utils";

export type FirstMapsBusiness = {
  id: string;
  name: string;
  placeId: string | null;
  addressText: string | null;
  scanCenterLabel: string | null;
  primaryCategory: string | null;
  websiteUrl: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  scanCenterLat: number | null;
  scanCenterLng: number | null;
  serviceAreaMode: string | null;
};

export type FirstMapsKeyword = {
  id: string;
  keyword: string;
  isPrimary: boolean;
};

export type FirstMapsSetupProps = {
  businessId: string;
  business: FirstMapsBusiness;
  keywords: FirstMapsKeyword[];
  /** When reviews look stronger than nearby competitors. */
  reviewsLookStrong?: boolean;
};

type StepId = "business" | "keyword" | "area" | "run" | "results";

const STEPS: Array<{ id: StepId; label: string }> = [
  { id: "business", label: "Business" },
  { id: "keyword", label: "Keyword" },
  { id: "area", label: "Scan area" },
  { id: "run", label: "Run scan" },
  { id: "results", label: "Results" },
];

const PROGRESS_MESSAGES = [
  "Checking locations across your grid…",
  "Finding your Google Maps position…",
  "Comparing nearby competitors…",
  "Building your visibility map…",
] as const;

type ScanSummary = {
  scanId: string;
  keyword: string;
  averageRank: number | null;
  top3Pct: number | null;
  top10Pct: number | null;
  notFoundCells: number | null;
  totalCells: number | null;
  bestArea: string | null;
  weakestArea: string | null;
  topCompetitors: Array<{ name: string; avgRank: number | null; appearances: number }>;
};

function cityFromAddress(address: string | null | undefined): string | null {
  if (!address?.trim()) return null;
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const city = parts[parts.length - 2]?.replace(/\s+[A-Z]{2}\s+\d+.*/i, "").trim();
    if (city && city.length < 40) return city;
  }
  return null;
}

function buildKeywordSuggestions(input: {
  name: string;
  category: string | null;
  city: string | null;
}): string[] {
  const category = (input.category ?? "").trim();
  const city = (input.city ?? "").trim();
  const name = (input.name ?? "").trim();
  const base =
    category ||
    name
      .replace(/\b(llc|inc|co|company|services?)\b/gi, "")
      .trim()
      .split(/\s+/)
      .slice(0, 3)
      .join(" ") ||
    "local business";

  const out = new Set<string>();
  out.add(base);
  out.add(`${base} near me`);
  if (city) {
    out.add(`${base} ${city}`);
    out.add(`best ${base} ${city}`);
  } else {
    out.add(`best ${base}`);
  }
  out.add(`${base} open now`);
  return [...out].filter(Boolean).slice(0, 8);
}

function pct(cells: number | null | undefined, total: number | null | undefined): number | null {
  if (cells == null || total == null || total <= 0) return null;
  return Math.round((cells / total) * 1000) / 10;
}

function fmtRank(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return String(Math.round(n * 10) / 10);
}

export function FirstMapsSetup({
  businessId,
  business,
  keywords: initialKeywords,
  reviewsLookStrong = false,
}: FirstMapsSetupProps) {
  const [step, setStep] = useState<StepId>("business");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Step 1 — business confirmation (local state)
  const [name, setName] = useState(business.name);
  const [placeId, setPlaceId] = useState(business.placeId ?? "");
  const [address, setAddress] = useState(
    business.scanCenterLabel || business.addressText || ""
  );
  const [category, setCategory] = useState(business.primaryCategory ?? "");
  const [website, setWebsite] = useState(business.websiteUrl ?? "");
  const [phone, setPhone] = useState(business.phone ?? "");
  const [centerLat, setCenterLat] = useState(
    business.scanCenterLat ?? business.lat ?? 0
  );
  const [centerLng, setCenterLng] = useState(
    business.scanCenterLng ?? business.lng ?? 0
  );

  // Step 2 — keywords
  const [keywords, setKeywords] = useState(initialKeywords);
  const [selected, setSelected] = useState<string[]>(() => {
    const primary = initialKeywords.find((k) => k.isPrimary) ?? initialKeywords[0];
    return primary ? [primary.keyword] : [];
  });
  const [customKeyword, setCustomKeyword] = useState("");

  // Step 3 — grid
  const [gridSize, setGridSize] = useState(DEFAULT_GRID_SIZE);
  const [radiusMeters, setRadiusMeters] = useState(DEFAULT_RADIUS_METERS);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Step 4–5 — run + results
  const [progressIndex, setProgressIndex] = useState(0);
  const [scanId, setScanId] = useState<string | null>(null);
  const [summary, setSummary] = useState<ScanSummary | null>(null);
  const scanStartedRef = useRef(false);

  const city = cityFromAddress(address) ?? cityFromAddress(business.addressText);
  const suggestions = useMemo(
    () =>
      buildKeywordSuggestions({
        name,
        category: category || business.primaryCategory,
        city,
      }),
    [name, category, business.primaryCategory, city]
  );

  const meta = useMemo(
    () => gridScanMeta(gridSize, radiusMeters),
    [gridSize, radiusMeters]
  );

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  const activeKeywordLabel = selected[0] ?? "";

  function toggleKeyword(term: string) {
    const t = term.trim();
    if (!t) return;
    setSelected((prev) => {
      if (prev.includes(t)) return prev.filter((x) => x !== t);
      // First Maps: prefer a single primary keyword, allow multi
      return [...prev, t];
    });
  }

  function addCustomKeyword() {
    const t = customKeyword.trim();
    if (!t) return;
    toggleKeyword(t);
    setCustomKeyword("");
  }

  async function persistCenterIfNeeded() {
    if (!Number.isFinite(centerLat) || !Number.isFinite(centerLng)) return;
    if (centerLat === 0 && centerLng === 0) return;
    const label = address.trim() || null;
    await updateBusinessSettings(businessId, {
      scan_center_lat: centerLat,
      scan_center_lng: centerLng,
      scan_center_label: label,
      grid_size: gridSize,
      radius_meters: radiusMeters,
    });
  }

  async function geocodeAddressIfNeeded() {
    const q = address.trim();
    if (!q) return;
    if (
      Number.isFinite(centerLat) &&
      Number.isFinite(centerLng) &&
      !(centerLat === 0 && centerLng === 0)
    ) {
      return;
    }
    const res = await fetch("/api/scans/geocode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: q }),
    });
    const json = (await res.json()) as {
      error?: string;
      lat?: number;
      lng?: number;
      displayName?: string;
      label?: string;
    };
    if (!res.ok) throw new Error(json.error ?? "Could not find that location");
    if (json.lat == null || json.lng == null) {
      throw new Error("Could not find that location");
    }
    setCenterLat(json.lat);
    setCenterLng(json.lng);
    if (json.displayName || json.label) {
      setAddress(json.displayName ?? json.label ?? q);
    }
  }

  async function goNextFromBusiness() {
    setError(null);
    setBusy(true);
    try {
      await geocodeAddressIfNeeded();
      // Optional persist of scan center / grid prefs
      try {
        await persistCenterIfNeeded();
      } catch {
        /* skip edits if save fails — scan can still use local state */
      }
      setStep("keyword");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not confirm business location");
    } finally {
      setBusy(false);
    }
  }

  function goNextFromKeyword() {
    setError(null);
    if (!selected.length) {
      setError("Choose at least one search keyword.");
      return;
    }
    setStep("area");
  }

  function goNextFromArea() {
    setError(null);
    if (
      !Number.isFinite(centerLat) ||
      !Number.isFinite(centerLng) ||
      (centerLat === 0 && centerLng === 0)
    ) {
      setError("Set a valid business location before scanning.");
      setStep("business");
      return;
    }
    setStep("run");
  }

  const loadSummary = useCallback(
    async (id: string, keywordLabel: string) => {
      const statusRes = await fetch(`/api/scans/${id}/status`);
      const statusJson = (await statusRes.json()) as {
        error?: string;
        batch?: {
          aggregate_metrics?: {
            averageRank?: number | null;
            top3Cells?: number;
            top10Cells?: number;
            notFoundCells?: number;
            totalCells?: number;
            visibilityScore?: number | null;
          } | null;
          grid_size?: number;
          radius_meters?: number;
        };
        points?: Array<{ id: string; grid_label?: string | null }>;
        results?: Array<{
          scan_point_id?: string;
          target_rank?: number | null;
          rank?: number | null;
        }>;
      };
      if (!statusRes.ok) {
        throw new Error(statusJson.error ?? "Could not load scan results");
      }

      const m = statusJson.batch?.aggregate_metrics ?? null;
      const total = m?.totalCells ?? null;
      const top3 = pct(m?.top3Cells ?? null, total);
      const top10 =
        m?.visibilityScore != null
          ? Number(m.visibilityScore)
          : pct(m?.top10Cells ?? null, total);

      let bestArea: string | null = null;
      let weakestArea: string | null = null;
      const pointsById = new Map(
        (statusJson.points ?? []).map((p) => [p.id, p.grid_label ?? null])
      );
      const ranked = (statusJson.results ?? [])
        .map((r) => {
          const rank =
            r.target_rank != null
              ? Number(r.target_rank)
              : r.rank != null
                ? Number(r.rank)
                : null;
          const label = r.scan_point_id
            ? pointsById.get(r.scan_point_id) ?? null
            : null;
          return { rank, label };
        })
        .filter((r) => r.label);
      const found = ranked
        .filter((r) => r.rank != null && r.rank > 0)
        .sort((a, b) => Number(a.rank) - Number(b.rank));
      const missing = ranked.filter((r) => r.rank == null);
      bestArea = found[0]?.label
        ? `Cell ${found[0].label} (rank ${found[0].rank})`
        : null;
      weakestArea = missing[0]?.label
        ? `Cell ${missing[0].label} (not found)`
        : found.length
          ? `Cell ${found[found.length - 1]?.label} (rank ${found[found.length - 1]?.rank})`
          : null;

      let topCompetitors: ScanSummary["topCompetitors"] = [];
      try {
        const compRes = await fetch(`/api/scans/${id}/competitors`);
        const compJson = (await compRes.json()) as {
          entities?: Array<{ key: string; label: string; isTarget?: boolean }>;
          addPool?: Array<{ key: string; label: string }>;
        };
        if (compRes.ok) {
          const labels = [
            ...(compJson.entities ?? []).filter((e) => !e.isTarget).map((e) => e.label),
            ...(compJson.addPool ?? []).map((e) => e.label),
          ];
          topCompetitors = labels.slice(0, 5).map((label) => ({
            name: label,
            avgRank: null,
            appearances: 0,
          }));
        }
      } catch {
        /* best-effort */
      }

      setSummary({
        scanId: id,
        keyword: keywordLabel,
        averageRank: m?.averageRank != null ? Number(m.averageRank) : null,
        top3Pct: top3,
        top10Pct: top10,
        notFoundCells: m?.notFoundCells ?? null,
        totalCells: total,
        bestArea,
        weakestArea,
        topCompetitors,
      });
      setStep("results");
    },
    []
  );

  async function startScan() {
    setError(null);
    setBusy(true);
    setProgressIndex(0);
    setSummary(null);
    try {
      await persistCenterIfNeeded().catch(() => undefined);

      const keyword = selected[0]!;
      // Prefer existing keyword id when present
      let keywordId = keywords.find(
        (k) => k.keyword.trim().toLowerCase() === keyword.trim().toLowerCase()
      )?.id;

      if (!keywordId) {
        const addRes = await fetch("/api/scans/keywords/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ businessId, keyword }),
        });
        const addJson = (await addRes.json()) as {
          error?: string;
          keyword?: { id: string; keyword: string; is_primary?: boolean };
        };
        if (!addRes.ok) {
          throw new Error(addJson.error ?? "Could not save keyword");
        }
        if (addJson.keyword?.id) {
          keywordId = addJson.keyword.id;
          setKeywords((prev) => [
            ...prev,
            {
              id: addJson.keyword!.id,
              keyword: addJson.keyword!.keyword,
              isPrimary: !!addJson.keyword!.is_primary,
            },
          ]);
        }
      }

      const res = await fetch("/api/scans/run-for-keyword", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          keywordId,
          keyword: keywordId ? undefined : keyword,
          gridSize,
          radiusMeters,
          device: DEFAULT_SCAN_PROFILE.device,
          os: osForScanDevice(DEFAULT_SCAN_PROFILE.device),
          browser: DEFAULT_SCAN_PROFILE.browser,
          mapsProviderMode: DEFAULT_MAPS_PROVIDER_MODE,
          dfsExecutionMode: DEFAULT_DFS_EXECUTION_MODE,
          locationZoom: DEFAULT_MAPS_LOCATION_ZOOM,
          centerLat,
          centerLng,
          centerLabel: address.trim() || undefined,
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        scan?: { id: string };
      };
      if (!res.ok) {
        throw new Error(
          customerSafeScanError(json.error) ??
            "We couldn't start the scan. Check the keyword and location, then try again."
        );
      }
      if (!json.scan?.id) throw new Error("Scan started but no scan id returned");
      setScanId(json.scan.id);
    } catch (e) {
      setError(
        customerSafeScanError(e instanceof Error ? e.message : String(e)) ?? "Scan failed"
      );
      setBusy(false);
    }
  }

  // Auto-start when entering run step
  useEffect(() => {
    if (step !== "run") return;
    if (scanStartedRef.current || scanId) return;
    scanStartedRef.current = true;
    void startScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start once per run entry
  }, [step, scanId]);

  // Progress message rotation while scanning
  useEffect(() => {
    if (step !== "run" || !scanId) return;
    const t = setInterval(() => {
      setProgressIndex((i) => (i + 1) % PROGRESS_MESSAGES.length);
    }, 2800);
    return () => clearInterval(t);
  }, [step, scanId]);

  // Poll scan status
  useEffect(() => {
    if (step !== "run" || !scanId) return;
    let active = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      try {
        const res = await fetch(`/api/scans/${scanId}/status`);
        const json = (await res.json()) as {
          error?: string;
          batch?: { status?: string; cells_completed?: number; cells_total?: number };
        };
        if (!res.ok) throw new Error(json.error ?? "Status check failed");
        const status = json.batch?.status ?? "";
        if (isMapRenderable(status) || status === "ready" || status === "partial" || status === "rank_ready") {
          if (!active) return;
          setBusy(false);
          await loadSummary(scanId!, activeKeywordLabel);
          return;
        }
        if (status === "failed" || status === "cancelled") {
          if (!active) return;
          setBusy(false);
          setError("The scan did not finish. Try again from Maps setup.");
          return;
        }
        if (SCAN_POLL_STATUSES.has(status) || !status) {
          const completed = Number(json.batch?.cells_completed ?? 0);
          const total = Number(json.batch?.cells_total ?? meta.cellCount);
          if (total > 0 && completed > 0) {
            // Nudge message toward location checking
            setProgressIndex(0);
          }
        }
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Could not check scan status");
        setBusy(false);
        return;
      }
      if (!active) return;
      timeoutId = setTimeout(() => {
        void poll();
      }, 2500);
    }

    void poll();
    return () => {
      active = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [step, scanId, activeKeywordLabel, loadSummary, meta.cellCount]);

  return (
    <ModulePage>
      <ModuleHeader
        icon={MapPin}
        title="First Maps Scan"
        subtitle="Confirm your business, pick a keyword, and run a local visibility grid."
        actions={
          <Link
            href={`/businesses/${businessId}/local-visibility`}
            className={btnSecondary}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        }
      />

      <nav className="flex flex-wrap gap-2" aria-label="Setup steps">
        {STEPS.map((s, i) => {
          const done = i < stepIndex;
          const active = s.id === step;
          return (
            <div
              key={s.id}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold",
                active && "bg-[#137752] text-white",
                done && !active && "bg-[#ECFDF3] text-[#137752]",
                !active && !done && "bg-zinc-100 text-zinc-500"
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : <span>{i + 1}</span>}
              {s.label}
            </div>
          );
        })}
      </nav>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
          {error}
        </div>
      ) : null}

      {step === "business" ? (
        <section className={cn(cardClass, cardPadding, "space-y-4")}>
          <h2 className="text-[14px] font-semibold text-zinc-900">Confirm business</h2>
          <p className="text-[13px] text-zinc-500">
            We&apos;ll use this as the center of your visibility scan. Edits stay local unless we
            can save your scan center.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className={fieldLabelClass}>Business name</span>
              <input className={cn(inputClass, "mt-1.5")} value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="block sm:col-span-2">
              <span className={fieldLabelClass}>GBP / Place ID</span>
              <input
                className={cn(inputClass, "mt-1.5")}
                value={placeId}
                onChange={(e) => setPlaceId(e.target.value)}
                placeholder="Optional Google Place ID"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className={fieldLabelClass}>Address / service area</span>
              <input
                className={cn(inputClass, "mt-1.5")}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street, city, or service area center"
              />
            </label>
            <label className="block">
              <span className={fieldLabelClass}>Primary category</span>
              <input
                className={cn(inputClass, "mt-1.5")}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </label>
            <label className="block">
              <span className={fieldLabelClass}>Phone</span>
              <input
                className={cn(inputClass, "mt-1.5")}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className={fieldLabelClass}>Website</span>
              <input
                className={cn(inputClass, "mt-1.5")}
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              className={btnPrimary}
              disabled={busy}
              onClick={() => void goNextFromBusiness()}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Confirm & continue
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      ) : null}

      {step === "keyword" ? (
        <section className={cn(cardClass, cardPadding, "space-y-4")}>
          <h2 className="text-[14px] font-semibold text-zinc-900">Choose search keyword</h2>
          <p className="text-[13px] text-zinc-500">
            Pick what customers type into Google Maps. Suggestions are based on your category,
            name, and city.
          </p>

          {keywords.length > 0 ? (
            <div>
              <p className={fieldLabelClass}>Existing keywords</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {keywords.map((k) => {
                  const on = selected.includes(k.keyword);
                  return (
                    <button
                      key={k.id}
                      type="button"
                      onClick={() => toggleKeyword(k.keyword)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-[13px] font-medium transition",
                        on
                          ? "border-[#137752] bg-[#ECFDF3] text-[#137752]"
                          : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                      )}
                    >
                      {k.keyword}
                      {k.isPrimary ? " · primary" : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div>
            <p className={fieldLabelClass}>Suggestions</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {suggestions.map((term) => {
                const on = selected.includes(term);
                return (
                  <button
                    key={term}
                    type="button"
                    onClick={() => toggleKeyword(term)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-[13px] font-medium transition",
                      on
                        ? "border-[#137752] bg-[#ECFDF3] text-[#137752]"
                        : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                    )}
                  >
                    {term}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-[220px] flex-1">
              <span className={fieldLabelClass}>Custom keyword</span>
              <input
                className={cn(inputClass, "mt-1.5")}
                value={customKeyword}
                onChange={(e) => setCustomKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomKeyword();
                  }
                }}
                placeholder="e.g. junk removal austin"
              />
            </label>
            <button type="button" className={btnSecondary} onClick={addCustomKeyword}>
              <Plus className="h-4 w-4" />
              Add
            </button>
          </div>

          {selected.length > 0 ? (
            <p className="text-[12px] text-zinc-500">
              Selected: <span className="font-medium text-zinc-800">{selected.join(", ")}</span>
              {selected.length > 1 ? " — first keyword will be scanned now" : ""}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-2">
            <button type="button" className={btnSecondary} onClick={() => setStep("business")}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <button type="button" className={btnPrimary} onClick={goNextFromKeyword}>
              Continue
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      ) : null}

      {step === "area" ? (
        <section className={cn(cardClass, cardPadding, "space-y-4")}>
          <h2 className="text-[14px] font-semibold text-zinc-900">Choose scan area</h2>
          <p className="text-[13px] text-zinc-500">
            Recommended: a {DEFAULT_GRID_SIZE}×{DEFAULT_GRID_SIZE} grid covering about{" "}
            {formatRadiusMiles(metersToMiles(DEFAULT_RADIUS_METERS))}.
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
                Center
              </p>
              <p className="mt-1 text-[13px] font-medium text-zinc-900">
                {address.trim() || "Account location"}
              </p>
              <p className="mt-1 text-[11px] tabular-nums text-zinc-500">
                {centerLat.toFixed(5)}, {centerLng.toFixed(5)}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
                Grid size
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-[13px] font-medium text-zinc-900">
                <Grid3X3 className="h-4 w-4 text-[#137752]" />
                {meta.gridSize}×{meta.gridSize} ({meta.cellCount} points)
              </p>
            </div>
            <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
                Approx radius
              </p>
              <p className="mt-1 text-[13px] font-medium text-zinc-900">
                {formatRadiusMiles(meta.radiusMiles)}
              </p>
              <p className="mt-1 text-[11px] text-zinc-500">
                ~{meta.coverageSqMi} sq mi coverage
              </p>
            </div>
          </div>

          <button
            type="button"
            className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#137752]"
            onClick={() => setShowAdvanced((v) => !v)}
          >
            Advanced
            <ChevronDown
              className={cn("h-4 w-4 transition", showAdvanced && "rotate-180")}
            />
          </button>

          {showAdvanced ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={fieldLabelClass}>Grid size</span>
                <select
                  className={cn(inputClass, "mt-1.5")}
                  value={gridSize}
                  onChange={(e) => setGridSize(Number(e.target.value))}
                >
                  {GRID_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}×{n} ({n * n} points)
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={fieldLabelClass}>Radius</span>
                <select
                  className={cn(inputClass, "mt-1.5")}
                  value={nearestRadiusMileOption(radiusMeters)}
                  onChange={(e) => setRadiusMeters(milesToMeters(Number(e.target.value)))}
                >
                  {RADIUS_MILE_PRESETS.map((p) => (
                    <option key={p.miles} value={p.miles}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-2">
            <button type="button" className={btnSecondary} onClick={() => setStep("keyword")}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <button type="button" className={btnPrimary} onClick={goNextFromArea}>
              Run scan
              <Search className="h-4 w-4" />
            </button>
          </div>
        </section>
      ) : null}

      {step === "run" ? (
        <section className={cn(cardClass, cardPadding, "space-y-4")}>
          <h2 className="text-[14px] font-semibold text-zinc-900">Running your first Maps scan</h2>
          <p className="text-[13px] text-zinc-500">
            Checking {meta.cellCount} locations for &ldquo;{activeKeywordLabel}&rdquo;.
          </p>
          <div className="flex items-center gap-3 rounded-xl border border-[#D1FADF] bg-[#ECFDF3] px-4 py-4">
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[#137752]" />
            <div>
              <p className="text-[13px] font-semibold text-[#137752]">
                {PROGRESS_MESSAGES[progressIndex]}
              </p>
              <p className="mt-0.5 text-[12px] text-zinc-600">
                Finding your Google Maps position · Comparing nearby competitors · Building your
                visibility map
              </p>
            </div>
          </div>
          {scanId ? (
            <p className="text-[11px] text-zinc-400">Scan id: {scanId}</p>
          ) : null}
        </section>
      ) : null}

      {step === "results" && summary ? (
        <section className={cn(cardClass, cardPadding, "space-y-5")}>
          <div>
            <h2 className="text-[14px] font-semibold text-zinc-900">Where do I rank?</h2>
            <p className="mt-1 text-[13px] text-zinc-500">
              Results for &ldquo;{summary.keyword}&rdquo; across your visibility grid.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label="Avg grid position"
              value={fmtRank(summary.averageRank)}
              icon={<Trophy className="h-4 w-4 text-[#137752]" />}
            />
            <Metric
              label="Top 3 share"
              value={summary.top3Pct != null ? `${summary.top3Pct}%` : "—"}
            />
            <Metric
              label="Top 10 share"
              value={summary.top10Pct != null ? `${summary.top10Pct}%` : "—"}
            />
            <Metric
              label="Not found"
              value={
                summary.notFoundCells != null && summary.totalCells != null
                  ? `${summary.notFoundCells} / ${summary.totalCells}`
                  : "—"
              }
            />
          </div>

          {(summary.bestArea || summary.weakestArea) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {summary.bestArea ? (
                <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
                    Best area
                  </p>
                  <p className="mt-1 text-[13px] font-medium text-zinc-900">{summary.bestArea}</p>
                </div>
              ) : null}
              {summary.weakestArea ? (
                <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
                    Weakest area
                  </p>
                  <p className="mt-1 text-[13px] font-medium text-zinc-900">
                    {summary.weakestArea}
                  </p>
                </div>
              ) : null}
            </div>
          )}

          {summary.topCompetitors.length > 0 ? (
            <div>
              <p className="text-[13px] font-semibold text-zinc-900">Top competing businesses</p>
              <ul className="mt-2 space-y-1.5">
                {summary.topCompetitors.map((c) => (
                  <li
                    key={c.name}
                    className="flex items-center justify-between rounded-lg border border-zinc-100 px-3 py-2 text-[13px]"
                  >
                    <span className="font-medium text-zinc-800">{c.name}</span>
                    {c.avgRank != null ? (
                      <span className="tabular-nums text-zinc-500">avg {fmtRank(c.avgRank)}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {reviewsLookStrong ? (
            <p className="rounded-xl border border-[#D1FADF] bg-[#ECFDF3] px-4 py-3 text-[13px] leading-snug text-[#085D3A]">
              <Star className="mr-1 inline h-3.5 w-3.5 fill-[#137752] text-[#137752]" />
              Your review performance is stronger than businesses currently outranking you in
              parts of this grid. Maps visibility — not just reviews — is shaping who shows up
              first.
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Link href={`/businesses/${businessId}/maps`} className={btnPrimary}>
              Open Maps Overview
            </Link>
            <Link
              href={`/businesses/${businessId}/grid/${summary.scanId}`}
              className={btnSecondary}
            >
              View full grid
            </Link>
          </div>
        </section>
      ) : null}
    </ModulePage>
  );
}

function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
        {label}
      </p>
      <p className="mt-1 flex items-center gap-1.5 text-xl font-bold tabular-nums text-zinc-900">
        {icon}
        {value}
      </p>
    </div>
  );
}
