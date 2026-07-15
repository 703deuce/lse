"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Gauge,
  Loader2,
  MapPin,
  Search,
  AlertTriangle,
  Trophy,
  Target,
  TrendingUp,
  ChevronDown,
  History,
  SlidersHorizontal,
  Info,
  Navigation2,
} from "lucide-react";
import { SetupMap } from "@/components/maps/setup-map";
import { ExpansionReachPanel } from "@/components/maps-difficulty/expansion-reach-panel";
import type { MapsDifficultyResult } from "@/lib/maps-difficulty/enrich";
import { BUCKET_MAX, PROFILE_STRENGTH_MAX } from "@/lib/maps-difficulty/score";
import type { ExpansionReachResult } from "@/lib/maps-difficulty/expansion-reach";
import type { LocalPageTier, ProfileOrder } from "@/lib/maps-difficulty/score";
import { useModuleJobRunner } from "@/components/jobs/use-module-job-runner";

type MapsDifficultyRunResponse = MapsDifficultyResult & {
  expansionReach?: ExpansionReachResult;
  expansionError?: string;
  id?: string;
};

const DEFAULT_CENTER: [number, number] = [39.8283, -98.5795]; // geographic center of the contiguous US

interface HistoryRow {
  id: string;
  keyword: string;
  cityLabel: string | null;
  address: string | null;
  businessBaseAddress?: string | null;
  mkdScore: number | null;
  difficultyLabel: string | null;
  expansionScore?: number | null;
  expansionLabel?: string | null;
  createdAt: string;
  result: MapsDifficultyRunResponse;
}

type ToolMode = "kd" | "expansion";

const BUCKET_META: { key: keyof MapsDifficultyResult["score"]["bucketScores"]; label: string; max: number }[] = [
  { key: "authority", label: "Authority", max: BUCKET_MAX.authority },
  { key: "reviews", label: "Reviews", max: BUCKET_MAX.reviews },
  { key: "incumbentStrength", label: "Incumbent Strength / Pack Protection", max: BUCKET_MAX.incumbentStrength },
  { key: "proximity", label: "Proximity / Pack Radius", max: BUCKET_MAX.proximity },
  { key: "localPage", label: "Local Page / On-page", max: BUCKET_MAX.localPage },
  { key: "gbpRelevance", label: "GBP / Relevance Alignment", max: BUCKET_MAX.gbpRelevance },
  { key: "brandFranchise", label: "Brand / Franchise", max: BUCKET_MAX.brandFranchise },
];

function labelColor(label: string): { bg: string; text: string; ring: string; bar: string } {
  switch (label) {
    case "Ultra Easy":
      return { bg: "bg-teal-50 dark:bg-teal-900/20", text: "text-teal-700 dark:text-teal-300", ring: "ring-teal-500", bar: "bg-teal-500" };
    case "Very Easy":
      return { bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-700 dark:text-emerald-300", ring: "ring-emerald-500", bar: "bg-emerald-500" };
    case "Easy":
      return { bg: "bg-lime-50 dark:bg-lime-900/20", text: "text-lime-700 dark:text-lime-300", ring: "ring-lime-500", bar: "bg-lime-500" };
    case "Moderate":
      return { bg: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-700 dark:text-amber-300", ring: "ring-amber-500", bar: "bg-amber-500" };
    case "Hard":
      return { bg: "bg-orange-50 dark:bg-orange-900/20", text: "text-orange-700 dark:text-orange-300", ring: "ring-orange-500", bar: "bg-orange-500" };
    case "Very Hard":
      return { bg: "bg-red-50 dark:bg-red-900/20", text: "text-red-700 dark:text-red-300", ring: "ring-red-500", bar: "bg-red-500" };
    case "Brutal":
    case "Extreme": // legacy v4–v5 label
      return { bg: "bg-rose-50 dark:bg-rose-900/20", text: "text-rose-700 dark:text-rose-300", ring: "ring-rose-600", bar: "bg-rose-600" };
    default:
      return { bg: "bg-surface-subtle dark:bg-zinc-900/20", text: "text-text dark:text-zinc-300", ring: "ring-zinc-500", bar: "bg-surface-subtle0" };
  }
}

const LOCAL_PAGE_META: Record<LocalPageTier, { label: string; cls: string; help: string }> = {
  "dedicated-local": {
    label: "dedicated-local",
    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    help: "Dedicated city/service landing page (city + service in title/H1).",
  },
  "homepage-local": {
    label: "homepage-local",
    cls: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
    help: "Homepage appears to function as the local landing page (city + service present).",
  },
  "generic-service": {
    label: "generic-service",
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    help: "Service page found, but weak city targeting.",
  },
  "weak-homepage": {
    label: "weak-homepage",
    cls: "bg-surface-subtle text-text-muted dark:bg-zinc-800 dark:text-text-muted",
    help: "Homepage fallback with weak local relevance.",
  },
  none: {
    label: "none",
    cls: "bg-surface-subtle text-text-muted dark:bg-zinc-800 dark:text-text-muted",
    help: "No useful indexed landing page found.",
  },
};

const PROFILE_HELP =
  "Profile combines proximity, reviews, authority, local-page relevance, GBP/category relevance, and brand/entity signals. A business can have low authority but still score strong if it is close, category-relevant, and review-competitive.";

/** Mirror of the server-side service derivation (strips the location tokens). */
function deriveService(keyword: string, loc: string): string {
  const stop = new Set(
    loc
      .toLowerCase()
      .split(/[\s,]+/)
      .filter(Boolean)
  );
  return keyword
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t && !stop.has(t))
    .join(" ")
    .trim();
}

function verdictHeadline(label: string): string {
  switch (label) {
    case "Ultra Easy":
      return "This market is wide open.";
    case "Very Easy":
      return "This market is very beatable.";
    case "Easy":
      return "This market is beatable.";
    case "Moderate":
      return "This market is competitive but winnable.";
    case "Hard":
      return "This market is competitive, but there's a displaceable slot.";
    case "Very Hard":
      return "This market is hard to break into.";
    default:
      return "This market is extremely hard to break into.";
  }
}

// Map legacy tier names (from runs saved before the relabel) to the current tiers.
const LEGACY_TIER_MAP: Record<string, LocalPageTier> = {
  strong: "dedicated-local",
  homepage: "homepage-local",
  generic: "generic-service",
  weak: "weak-homepage",
  none: "none",
};

function localPageMeta(tier: string) {
  const key = (LOCAL_PAGE_META[tier as LocalPageTier] ? tier : LEGACY_TIER_MAP[tier]) as LocalPageTier;
  return LOCAL_PAGE_META[key] ?? LOCAL_PAGE_META.none;
}

const PROFILE_ORDER_META: Record<ProfileOrder, { label: string; cls: string }> = {
  weakest: { label: "weakest", cls: "text-primary dark:text-emerald-400" },
  middle: { label: "middle", cls: "text-amber-600 dark:text-amber-400" },
  strongest: { label: "strongest", cls: "text-text-muted dark:text-text-muted" },
};

export function MapsDifficultyTool() {
  const [mode, setMode] = useState<ToolMode>("kd");
  const [keyword, setKeyword] = useState("");
  const [address, setAddress] = useState("");
  const [label, setLabel] = useState("");
  const [labelTouched, setLabelTouched] = useState(false);
  const [service, setService] = useState("");
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [coordsResolved, setCoordsResolved] = useState(false);

  const [businessBase, setBusinessBase] = useState("");

  const [geocoding, setGeocoding] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [expansionLoading, setExpansionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expansionError, setExpansionError] = useState<string | null>(null);
  const [result, setResult] = useState<MapsDifficultyRunResponse | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showAdvancedInputs, setShowAdvancedInputs] = useState(false);

  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/maps-difficulty/history");
      if (!res.ok) return;
      const data = await res.json();
      setHistory((data.runs ?? []) as HistoryRow[]);
      return (data.runs ?? []) as HistoryRow[];
    } catch {
      /* history is best-effort */
      return [] as HistoryRow[];
    }
  }, []);

  const {
    start: startJob,
    running: jobRunning,
    error: jobError,
    setError: setJobError,
  } = useModuleJobRunner({
    onSettled: async (info) => {
      setLoading(false);
      if (!info.ok) {
        // Keep prior successful result on screen; error banner comes from the runner.
        return;
      }
      const runs = (await loadHistory()) ?? [];
      const latest = runs[0];
      if (latest) {
        setResult(latest.result);
        setRunId(latest.id);
        if (latest.result.expansionReach == null && latest.result.expansionError) {
          setExpansionError(String(latest.result.expansionError));
        }
      }
    },
  });

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (jobError) setError(jobError);
  }, [jobError]);

  async function geocode(): Promise<{ lat: number; lng: number; label: string } | null> {
    if (!address.trim()) {
      setGeoError("Enter an address, or a city and state.");
      return null;
    }
    setGeocoding(true);
    setGeoError(null);
    try {
      const res = await fetch("/api/maps-difficulty/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not find that location");
      setCenter([data.lat, data.lng]);
      setCoordsResolved(true);
      // The resolved city always drives the label unless the user set a custom one.
      if (!labelTouched) setLabel(data.label ?? address);
      return { lat: data.lat, lng: data.lng, label: (data.label ?? address) as string };
    } catch (err) {
      setGeoError(err instanceof Error ? err.message : "Geocoding failed");
      return null;
    } finally {
      setGeocoding(false);
    }
  }

  async function run() {
    setLoading(true);
    setError(null);
    setExpansionError(null);
    setResult(null);
    try {
      let point: [number, number] = center;
      let effectiveLabel = label;
      if (!coordsResolved) {
        const geo = await geocode();
        if (!geo) {
          setLoading(false);
          return;
        }
        point = [geo.lat, geo.lng];
        if (!labelTouched) effectiveLabel = geo.label;
      }

      if (mode === "expansion" && !businessBase.trim()) {
        setError("Enter your business base address or city/state for Expansion Reach.");
        setLoading(false);
        return;
      }

      const payload: Record<string, unknown> = {
        keyword,
        label: effectiveLabel,
        service,
        address,
        lat: point[0],
        lng: point[1],
      };
      if (mode === "expansion") payload.businessBaseAddress = businessBase.trim();

      setJobError(null);
      const json = await startJob("/api/maps-difficulty/run", payload, "Run failed");
      if (!json.queued) {
        // Sync escape hatch (local debug) — treat body as result.
        if (json.id || json.score) {
          setResult(json as unknown as MapsDifficultyRunResponse);
          setRunId(typeof json.id === "string" ? json.id : null);
          if (json.expansionError) setExpansionError(String(json.expansionError));
        }
        await loadHistory();
        setLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Run failed");
      setLoading(false);
    }
  }

  /** Recalculate Expansion Reach only — reuses cached KD result, geocodes base only. */
  async function recheckExpansionOnly() {
    if (!result || !businessBase.trim()) return;
    setExpansionLoading(true);
    setExpansionError(null);
    try {
      const res = await fetch("/api/maps-difficulty/expansion-reach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId,
          businessBaseAddress: businessBase.trim(),
          kdResult: result,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Expansion Reach failed");
      setResult({ ...result, expansionReach: data.expansionReach as ExpansionReachResult });
      loadHistory();
    } catch (err) {
      setExpansionError(err instanceof Error ? err.message : "Expansion Reach failed");
    } finally {
      setExpansionLoading(false);
    }
  }

  function openHistoryRun(row: HistoryRow) {
    setResult(row.result);
    setRunId(row.id);
    setKeyword(row.result.keyword);
    if (row.cityLabel) {
      setLabel(row.cityLabel);
      setAddress(row.address ?? row.cityLabel);
      setLabelTouched(true);
    }
    if (row.businessBaseAddress) {
      setBusinessBase(row.businessBaseAddress);
      setMode("expansion");
    }
    setCenter([row.result.searchPoint.lat, row.result.searchPoint.lng]);
    setCoordsResolved(true);
    setShowHistory(false);
    setError(null);
    setExpansionError(null);
  }

  const score = result?.score;
  const expansion = result?.expansionReach;
  const colors = score ? labelColor(score.difficultyLabel) : null;
  const bucketTotal = score
    ? Object.values(score.bucketScores).reduce((s, v) => s + (typeof v === "number" ? v : 0), 0)
    : 0;
  const runBusy = loading || jobRunning;
  const canRecheckExpansion = mode === "expansion" && result && businessBase.trim() && !runBusy;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white">
          <Gauge className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-text dark:text-zinc-50">Maps Keyword Difficulty</h1>
          <p className="text-sm text-text-muted">
            {mode === "expansion"
              ? "Can I rank here from my location? Compare your business base against the current Map Pack radius."
              : "How hard it is to break into the Google Maps 3-pack — not how hard it is to become #1."}
          </p>
        </div>
        <button
          onClick={() => setShowHistory((s) => !s)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-text-muted hover:bg-surface-subtle dark:border-zinc-800 dark:text-text-muted dark:hover:bg-zinc-900"
        >
          <History className="h-4 w-4" />
          History{history.length ? ` (${history.length})` : ""}
        </button>
      </div>

      {/* ---- history panel ---- */}
      {showHistory && (
        <div className="mb-6 overflow-hidden rounded-2xl border border-border bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="border-b border-border px-5 py-3 text-sm font-semibold text-text-muted dark:border-zinc-800">
            Recent runs
          </div>
          {history.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-text-muted">No saved runs yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {history.map((row) => {
                const c = labelColor(row.difficultyLabel ?? "Moderate");
                return (
                  <li key={row.id}>
                    <button
                      onClick={() => openHistoryRun(row)}
                      className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-surface-subtle dark:hover:bg-zinc-900"
                    >
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${c.bg} ${c.text}`}>
                        {row.expansionScore ?? row.mkdScore ?? "?"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-text dark:text-zinc-50">{row.keyword}</span>
                        <span className="block truncate text-xs text-text-muted">
                          {row.cityLabel ?? "—"} · {row.expansionLabel ?? row.difficultyLabel} · {new Date(row.createdAt).toLocaleString()}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* ---- mode tabs ---- */}
      <div className="mb-4 flex rounded-xl border border-border bg-surface-subtle p-1 dark:border-zinc-800 dark:bg-zinc-900">
        <button
          onClick={() => setMode("kd")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
            mode === "kd"
              ? "bg-white text-text shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
              : "text-text-muted hover:text-text dark:hover:text-zinc-300"
          }`}
        >
          <Gauge className="h-4 w-4" />
          Keyword Difficulty
        </button>
        <button
          onClick={() => setMode("expansion")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
            mode === "expansion"
              ? "bg-white text-text shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
              : "text-text-muted hover:text-text dark:hover:text-zinc-300"
          }`}
        >
          <Navigation2 className="h-4 w-4" />
          Expansion Reach
        </button>
      </div>

      {/* ---- input form ---- */}
      <div className="grid gap-6 rounded-2xl border border-border bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950 lg:grid-cols-2">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-text dark:text-zinc-300">Keyword</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="junk removal woodbridge va"
                className="w-full rounded-lg border border-border bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-text dark:text-zinc-300">
              {mode === "expansion" ? "Target search area" : "Location (address, or city & state)"}
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    setCoordsResolved(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      geocode();
                    }
                  }}
                  placeholder="Woodbridge, VA  ·  or  123 Main St, Woodbridge, VA"
                  className="w-full rounded-lg border border-border bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>
              <button
                onClick={geocode}
                disabled={geocoding || !address.trim()}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-text hover:bg-surface-subtle disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                {geocoding ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                Find
              </button>
            </div>
            <p className="mt-1 text-xs text-text-muted">
              {geoError ? (
                <span className="text-red-600 dark:text-red-400">{geoError}</span>
              ) : coordsResolved ? (
                <>Pin set at {center[0].toFixed(4)}, {center[1].toFixed(4)} — coordinates found for you.</>
              ) : (
                <>
                  Full street address = most precise. City &amp; state = we locate the city center. Press Find (or Enter) to
                  locate it.
                </>
              )}
            </p>
          </div>

          {mode === "expansion" && (
            <div>
              <label className="mb-1 block text-sm font-medium text-text dark:text-zinc-300">
                Your business base (address or city &amp; state)
              </label>
              <div className="relative">
                <Navigation2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input
                  value={businessBase}
                  onChange={(e) => {
                    setBusinessBase(e.target.value);
                    setExpansionError(null);
                  }}
                  placeholder="123 Main St, Manassas, VA  ·  or  Manassas, VA"
                  className="w-full rounded-lg border border-border bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>
              <p className="mt-1 text-xs text-text-muted">
                Use this if your business is based outside the target search area. We compare your base distance to the
                current top-3 radius — not your reviews, backlinks, or GBP.
              </p>
              {expansionError && (
                <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{expansionError}</span>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-text dark:text-zinc-300">
              Service <span className="font-normal text-text-muted">(optional — for on-page match)</span>
            </label>
            <input
              value={service}
              onChange={(e) => setService(e.target.value)}
              placeholder="auto-detected from your keyword (e.g. plumber, roofing)"
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900"
            />
            {!service.trim() && keyword.trim() && deriveService(keyword, `${label} ${address}`) && (
              <p className="mt-1 text-xs text-text-muted">
                Auto-detected:{" "}
                <span className="font-medium text-text dark:text-zinc-300">
                  {deriveService(keyword, `${label} ${address}`)}
                </span>
              </p>
            )}
          </div>

          {/* advanced inputs */}
          <div>
            <button
              onClick={() => setShowAdvancedInputs((s) => !s)}
              className="inline-flex items-center gap-1 text-xs font-medium text-text-muted hover:text-text dark:hover:text-zinc-300"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Advanced
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAdvancedInputs ? "rotate-180" : ""}`} />
            </button>
            {showAdvancedInputs && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-muted">Location label (auto)</label>
                  <input
                    value={label}
                    onChange={(e) => {
                      setLabel(e.target.value);
                      setLabelTouched(true);
                    }}
                    placeholder="auto-filled from the address"
                    className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-muted">Lat</label>
                    <input
                      type="number"
                      step="any"
                      value={center[0]}
                      onChange={(e) => {
                        setCenter([Number(e.target.value), center[1]]);
                        setCoordsResolved(true);
                      }}
                      className="w-full rounded-lg border border-border bg-white px-2 py-2 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-muted">Lng</label>
                    <input
                      type="number"
                      step="any"
                      value={center[1]}
                      onChange={(e) => {
                        setCenter([center[0], Number(e.target.value)]);
                        setCoordsResolved(true);
                      }}
                      className="w-full rounded-lg border border-border bg-white px-2 py-2 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={run}
            disabled={runBusy || geocoding || expansionLoading || !keyword.trim() || (!coordsResolved && !address.trim()) || (mode === "expansion" && !businessBase.trim())}
            className={`inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              mode === "expansion" ? "bg-sky-600 hover:bg-sky-700" : "bg-primary hover:bg-primary-hover"
            }`}
          >
            {runBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : mode === "expansion" ? (
              <Navigation2 className="h-4 w-4" />
            ) : (
              <Gauge className="h-4 w-4" />
            )}
            {runBusy
              ? "Analyzing the 3-pack…"
              : mode === "expansion"
                ? "Check Expansion Reach"
                : "Run difficulty analysis"}
          </button>
          {canRecheckExpansion && (
            <button
              onClick={recheckExpansionOnly}
              disabled={expansionLoading || runBusy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-sky-300 px-4 py-2 text-sm font-medium text-sky-700 hover:bg-sky-50 disabled:opacity-60 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-900/20"
            >
              {expansionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation2 className="h-4 w-4" />}
              Recheck reach only (no new KD run)
            </button>
          )}
          {runBusy && (
            <p className="text-center text-xs text-text-muted">
              Queued analysis — enriching the top 3 (reviews, links, GBP, local pages). This takes ~30–90s.
            </p>
          )}
        </div>

        <div>
          <label className="mb-1 flex items-center gap-1 text-sm font-medium text-text dark:text-zinc-300">
            <MapPin className="h-4 w-4" /> Fine-tune the pin (optional)
          </label>
          <SetupMap
            center={center}
            onCenterChange={(lat, lng) => {
              setCenter([lat, lng]);
              setCoordsResolved(true);
            }}
            height="300px"
          />
          <p className="mt-1 flex items-start gap-1.5 text-xs text-text-muted">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-muted" />
            <span>Maps difficulty is pin-sensitive — moving the pin can change proximity, competitors, and the score.</span>
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ---- results ---- */}
      {score && colors && result && (
        <div className="mt-8 space-y-6">
          {/* Expansion Reach results (when mode or data has expansion) */}
          {expansion && (
            <ExpansionReachPanel
              expansion={expansion}
              mkdScore={score.mapsKeywordDifficulty}
              mkdLabel={score.difficultyLabel}
            />
          )}

          {/* score header — show for KD mode, or as secondary when expansion shown */}
          {(!expansion || mode === "kd") && (
          <div className={`flex flex-col items-center gap-4 rounded-2xl border border-border p-6 dark:border-zinc-800 sm:flex-row sm:items-stretch ${colors.bg}`}>
            <div className={`flex h-32 w-32 shrink-0 flex-col items-center justify-center rounded-full bg-white/70 ring-4 dark:bg-zinc-950/50 ${colors.ring}`}>
              <span className={`text-4xl font-black ${colors.text}`}>{score.mapsKeywordDifficulty}</span>
              <span className="text-xs font-medium text-text-muted">/ 100</span>
            </div>
            <div className="flex flex-1 flex-col justify-center">
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-sm font-bold ${colors.text} ${colors.bg} ring-1 ${colors.ring}`}>
                  {score.difficultyLabel}
                </span>
                <span className="rounded-full bg-surface-subtle px-2 py-0.5 text-xs font-medium text-text-muted dark:bg-zinc-800">
                  intent: break into top 3
                </span>
              </div>
              <h2 className="mt-2 text-lg font-semibold text-text dark:text-zinc-50">{result.keyword}</h2>
              <p className="text-sm text-text-muted">
                {result.cityLabel} · pin {result.searchPoint.lat.toFixed(4)}, {result.searchPoint.lng.toFixed(4)} · radius{" "}
                {score.radius.maxDistanceMi ?? "?"}mi max
              </p>
              {/* plain-language score math */}
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span className="text-text-muted">Bucket total</span>
                <span className="font-semibold text-text dark:text-zinc-300">{bucketTotal}</span>
                <span className="text-text-muted">·</span>
                <span className="text-text-muted">final</span>
                <span className={`font-semibold ${colors.text}`}>{score.mapsKeywordDifficulty}</span>
                <button
                  onClick={() => setShowAdvanced((s) => !s)}
                  className="ml-1 text-xs text-text-muted underline decoration-dotted hover:text-text-muted dark:hover:text-zinc-300"
                >
                  {showAdvanced ? "Hide" : "Scoring notes"}
                </button>
              </div>
              {showAdvanced && (
                <div className="mt-1 space-y-1 text-xs text-text-muted">
                  <p>
                    v6 scoring: table-stakes signals (proximity, local page, GBP) max 15 total. Competitive weight sits in
                    authority, reviews, and incumbent strength.
                  </p>
                  {score.reasonForRankProtection && <p>Pack protection: {score.reasonForRankProtection}</p>}
                  {score.incumbentStrengthReasons?.length > 0 && (
                    <p>Incumbent strength: {score.incumbentStrengthReasons.join("; ")}</p>
                  )}
                  <p className="italic">
                    Maps difficulty is pin-sensitive — moving the search pin can change proximity, the competitors in the pack,
                    and the score.
                  </p>
                </div>
              )}
            </div>
          </div>
          )}

          {/* what this means */}
          <div className={`rounded-2xl border border-border p-6 dark:border-zinc-800 ${colors.bg}`}>
            <h3 className={`text-sm font-semibold ${colors.text}`}>{verdictHeadline(score.difficultyLabel)}</h3>
            <p className="mt-1 text-sm text-text-muted dark:text-zinc-300">
              {[...score.mainReasons].join(". ")}
              {score.mainReasons.length ? ". " : ""}
              {score.opportunityNotes.join(" ")}
            </p>
          </div>

          {/* buckets */}
          <div className="rounded-2xl border border-border bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-text-muted">Difficulty by signal</h3>
            <div className="space-y-3">
              {BUCKET_META.map((b) => {
                const val = score.bucketScores[b.key] ?? 0;
                const pct = Math.min(100, (val / b.max) * 100);
                return (
                  <div key={b.key}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-text dark:text-zinc-300">{b.label}</span>
                      <span className="tabular-nums text-text-muted">
                        {val} <span className="text-text-muted">/ {b.max}</span>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-subtle dark:bg-zinc-800">
                      <div className={`h-full rounded-full ${colors.bar}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {score.incumbentStrengthReasons?.length > 0 && (
              <div className="mt-5 space-y-2 border-t border-border pt-4 text-xs text-text-muted dark:border-zinc-800">
                {score.incumbentStrengthReasons?.length > 0 && (
                  <p>
                    <span className="font-medium text-text-muted dark:text-text-muted">Incumbent strength:</span>{" "}
                    {score.incumbentStrengthReasons.join(" · ")}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* displacement target */}
          <div className="rounded-2xl border border-border bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-start gap-3">
              <Target className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <h3 className="text-sm font-semibold text-text dark:text-zinc-50">
                  Displacement target by measurable profile: {score.displacementTargetName}{" "}
                  <span className="font-normal text-text-muted">(Maps #{score.displacementTargetMapsRank})</span>
                </h3>
                {score.displacementTargetMapsRank === 3 ? (
                  <p className="mt-1 text-sm text-text-muted">
                    This is both the weakest measurable profile ({score.displacementTargetProfileStrength}/{PROFILE_STRENGTH_MAX}) and the current #3
                    slot — the realistic seat to take when breaking into the pack.
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-text-muted">
                    This business has the weakest measurable profile ({score.displacementTargetProfileStrength}/{PROFILE_STRENGTH_MAX}), but it
                    currently ranks #{score.displacementTargetMapsRank}, so incumbent-strength scoring reflects hidden trust
                    signals such as GBP age, entity history, behavioral data, or local brand strength.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* top 3 table */}
          <div className="overflow-hidden rounded-2xl border border-border bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <div className="border-b border-border px-6 py-3 dark:border-zinc-800">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Top 3 incumbents</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-text-muted">
                    <th className="px-6 py-2 font-medium">#</th>
                    <th className="px-3 py-2 font-medium">Business</th>
                    <th className="px-3 py-2 font-medium">Profile order</th>
                    <th className="px-3 py-2 text-right font-medium">
                      <span className="inline-flex items-center gap-1" title={PROFILE_HELP}>
                        Profile
                        <Info className="h-3 w-3 text-text-muted" />
                      </span>
                    </th>
                    <th className="px-3 py-2 text-right font-medium">Dist</th>
                    <th className="px-3 py-2 text-right font-medium">Reviews</th>
                    <th className="px-3 py-2 text-right font-medium">90d</th>
                    <th className="px-3 py-2 font-medium">Authority</th>
                    <th className="px-3 py-2 font-medium">Local pg</th>
                    <th className="px-3 py-2 font-medium">Category</th>
                  </tr>
                </thead>
                <tbody>
                  {score.top3Summary.map((b) => {
                    const lp = localPageMeta(b.localPageTier);
                    const po = PROFILE_ORDER_META[b.profileOrder] ?? PROFILE_ORDER_META.middle;
                    return (
                      <tr
                        key={b.rank}
                        className={`border-t border-border dark:border-zinc-800 ${b.isDisplacementTarget ? "bg-emerald-50/50 dark:bg-emerald-900/10" : ""}`}
                      >
                        <td className="px-6 py-3 font-semibold text-text-muted">{b.rank}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5 font-medium text-text dark:text-zinc-50">
                            {b.name}
                            {b.isDisplacementTarget && <Target className="h-3.5 w-3.5 text-primary" />}
                            {b.franchise && (
                              <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                                franchise
                              </span>
                            )}
                          </div>
                        </td>
                        <td className={`px-3 py-3 text-xs font-medium ${po.cls}`}>{po.label}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-text-muted dark:text-text-muted">{b.individualStrength}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-text-muted dark:text-text-muted">{b.distanceMi ?? "?"}mi</td>
                        <td className="px-3 py-3 text-right tabular-nums text-text-muted dark:text-text-muted">{b.totalReviews}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-text-muted dark:text-text-muted">{b.reviews90d}</td>
                        <td className="px-3 py-3 text-xs text-text-muted dark:text-text-muted">
                          <div className="space-y-0.5">
                            <div>
                              Page: <span className="tabular-nums font-medium">{b.pageCleanDofollowRefDomains}</span> clean dofollow RDs
                            </div>
                            <div>
                              Root: <span className="tabular-nums font-medium">{b.rootCleanDofollowRefDomains}</span> clean dofollow RDs
                            </div>
                            <div className="font-medium text-text dark:text-zinc-300">
                              Combined: {b.authorityStrengthLabel}
                            </div>
                            {b.authorityNote && (
                              <p className="mt-1 text-[11px] leading-snug text-amber-700 dark:text-amber-300">{b.authorityNote}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span
                            title={lp.help}
                            className={`cursor-help rounded px-1.5 py-0.5 text-[11px] font-medium ${lp.cls}`}
                          >
                            {lp.label}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-text-muted">{b.gmbPrimaryCategory ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="flex items-start gap-1.5 border-t border-border px-6 py-3 text-xs text-text-muted dark:border-zinc-800">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-muted" />
              <span>{PROFILE_HELP}</span>
            </p>
          </div>

          {/* narrative */}
          <div className="grid gap-4 md:grid-cols-3">
            <NarrativeCard icon={<Trophy className="h-4 w-4" />} title="Why this score" items={score.mainReasons} tone="zinc" />
            <NarrativeCard icon={<AlertTriangle className="h-4 w-4" />} title="Weak signals in top 3" items={score.weakestSignalsInTop3} tone="amber" />
            <NarrativeCard icon={<TrendingUp className="h-4 w-4" />} title="Your opportunities" items={score.opportunityNotes} tone="emerald" />
          </div>

          {/* raw debug */}
          <div className="rounded-2xl border border-border bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <button
              onClick={() => setShowRaw((s) => !s)}
              className="flex w-full items-center justify-between px-6 py-4 text-sm font-medium text-text-muted dark:text-text-muted"
            >
              <span>Raw enriched JSON (debug)</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${showRaw ? "rotate-180" : ""}`} />
            </button>
            {showRaw && (
              <pre className="max-h-96 overflow-auto border-t border-border bg-surface-subtle p-4 text-xs text-text-muted dark:border-zinc-800 dark:bg-zinc-900 dark:text-text-muted">
                {JSON.stringify(result, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Modifier({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-surface-subtle p-3 text-center dark:bg-zinc-900">
      <div className={`text-lg font-bold ${value > 0 ? "text-primary" : "text-text-muted"}`}>
        {value > 0 ? `+${value}` : "0"}
      </div>
      <div className="mt-0.5 text-[11px] leading-tight text-text-muted">{label}</div>
    </div>
  );
}

function NarrativeCard({
  icon,
  title,
  items,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
  tone: "zinc" | "amber" | "emerald";
}) {
  const toneClass = {
    zinc: "text-text-muted dark:text-text-muted",
    amber: "text-amber-600 dark:text-amber-400",
    emerald: "text-primary dark:text-emerald-400",
  }[tone];
  return (
    <div className="rounded-2xl border border-border bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <div className={`mb-3 flex items-center gap-2 text-sm font-semibold ${toneClass}`}>
        {icon}
        {title}
      </div>
      <ul className="space-y-2 text-sm text-text-muted dark:text-text-muted">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2">
            <span className={toneClass}>•</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
