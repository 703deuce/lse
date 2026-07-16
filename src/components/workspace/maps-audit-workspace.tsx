"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Grid3X3, Loader2, Play, Sparkles } from "lucide-react";
import { GridToolbar } from "@/components/scan/grid-toolbar";
import {
  CompetitorGridToggle,
  type CompetitorAddOption,
  type EntityOption,
} from "@/components/scan/competitor-grid-toggle";
import { CellInspectorDrawer } from "@/components/scan/cell-inspector-drawer";
import { ScanTimelineSlider } from "@/components/scan/scan-timeline-slider";
import { RankByDistanceCard } from "@/components/maps/rank-by-distance-card";
import { computeGridRankByDistance } from "@/lib/maps/rank-by-distance";
import { GridRankLegend } from "@/components/maps/grid-rank-legend";
import { GRID_COLOR_MODE_STORAGE_KEY, type GridColorMode } from "@/lib/maps/colors";
import {
  DEFAULT_RADIUS_METERS,
  computeSolv,
  gridRingCheckboxLabel,
  gridRingDistancesMiles,
} from "@/lib/maps/grid-metrics";
import { parseGridLabel } from "@/lib/maps/grid-entity";
import type { GridCell } from "@/components/maps/scan-map";
import { MetricCard } from "@/components/ui/metric-card";
import type { GrowthTask } from "@/lib/growth-audit/types";

const ScanMap = dynamic(
  () => import("@/components/maps/scan-map").then((m) => m.ScanMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-surface-subtle dark:bg-zinc-900">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    ),
  }
);

interface Listing {
  id: string;
  name: string;
  isTarget?: boolean;
  rank?: number;
  rating?: number;
  reviewCount?: number;
  category?: string | null;
  address?: string | null;
}

interface WorkspaceData {
  keyword: string;
  city: string;
  state: string;
  gbp: {
    name: string;
    primaryCategory?: string | null;
    rating?: number;
    reviewCount?: number;
    photoCount?: number;
    phone?: string | null;
    address?: string | null;
    website?: string | null;
  } | null;
  listings: Listing[];
  center: [number, number];
  latestScan?: {
    id: string;
    grid_size?: number;
    radius_meters?: number;
    status?: string;
    created_at?: string;
  } | null;
}

export function MapsAuditWorkspace({ businessId }: { businessId: string }) {
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [selectedId, setSelectedId] = useState<string>("target");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [growthScore, setGrowthScore] = useState<number | null>(null);
  const [topTasks, setTopTasks] = useState<GrowthTask[]>([]);
  const [auditRunning, setAuditRunning] = useState(false);
  const [scanId, setScanId] = useState<string | null>(null);
  const [keywordId, setKeywordId] = useState<string | null>(null);
  const [entityKey, setEntityKey] = useState("you");
  const [baseEntities, setBaseEntities] = useState<EntityOption[]>([]);
  const [addPool, setAddPool] = useState<CompetitorAddOption[]>([]);
  const [extraEntityKeys, setExtraEntityKeys] = useState<string[]>([]);
  const [gridCells, setGridCells] = useState<GridCell[]>([]);
  const [gridMetrics, setGridMetrics] = useState<{ solv: number; avgRank: number | null } | null>(null);
  const [inspectorCellId, setInspectorCellId] = useState<string | null>(null);
  const [colorMode, setColorMode] = useState<GridColorMode>("falcon");
  const [showRadiusRings, setShowRadiusRings] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [wsRes, auditRes] = await Promise.all([
        fetch(`/api/workspace/${businessId}`),
        fetch(`/api/growth-audit/${businessId}`),
      ]);
      const wsJson = await wsRes.json();
      if (!wsRes.ok) throw new Error(wsJson.error ?? "Failed to load workspace");
      setData(wsJson);
      setSelectedId("target");

      const auditJson = await auditRes.json();
      if (auditJson.run) {
        setGrowthScore(auditJson.run.growthScore);
        setTopTasks((auditJson.run.growthPlan ?? []).slice(0, 5));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(GRID_COLOR_MODE_STORAGE_KEY);
      if (stored === "strict" || stored === "falcon") setColorMode(stored);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (data?.latestScan?.id) setScanId(data.latestScan.id);
  }, [data?.latestScan?.id]);

  const loadGrid = useCallback(async () => {
    if (!scanId) {
      setGridCells([]);
      return;
    }
    const params = new URLSearchParams();
    if (keywordId) params.set("keywordId", keywordId);
    const entityParam = entityKey !== "you" ? `&entityKey=${encodeURIComponent(entityKey)}` : "";
    const res = await fetch(`/api/scans/${scanId}/competitors?${params}${entityParam}`);
    if (!res.ok) return;
    const json = await res.json();
    setBaseEntities(
      (json.entities ?? []).map((e: EntityOption) => ({
        key: e.key,
        label: e.label,
        isTarget: e.isTarget,
      }))
    );
    setAddPool(
      (json.addPool ?? []).map((e: CompetitorAddOption) => ({
        key: e.key,
        label: e.label,
        placeId: e.placeId,
        subtitle: e.subtitle,
      }))
    );
    const cells = (json.cells ?? []).map(
      (c: { label: string; lat: number; lng: number; rank: number | null; pending?: boolean; notInResults?: boolean; pointId: string }) => ({
        label: c.label,
        lat: c.lat,
        lng: c.lng,
        rank: c.rank,
        pending: c.pending,
        notInResults: c.notInResults,
        pointId: c.pointId,
      })
    );
    setGridCells(cells);
    if (json.metrics) {
      setGridMetrics({
        solv: json.solv ?? computeSolv(json.metrics.top3Cells, json.metrics.totalCells),
        avgRank: json.metrics.averageRank,
      });
    }
  }, [scanId, keywordId, entityKey]);

  useEffect(() => {
    void loadGrid();
  }, [loadGrid]);

  useEffect(() => {
    setExtraEntityKeys([]);
    setEntityKey("you");
  }, [scanId, keywordId]);

  const entities = useMemo(() => {
    const chips = [...baseEntities];
    const shown = new Set(chips.map((e) => e.key));
    for (const key of extraEntityKeys) {
      if (shown.has(key)) continue;
      const fromPool = addPool.find((e) => e.key === key);
      if (!fromPool) continue;
      chips.push({ key: fromPool.key, label: fromPool.label, isTarget: false });
      shown.add(key);
    }
    return chips;
  }, [baseEntities, addPool, extraEntityKeys]);

  const pickerPool = useMemo(() => {
    const shown = new Set(entities.map((e) => e.key));
    return addPool.filter((e) => !shown.has(e.key));
  }, [addPool, entities]);

  const removableKeys = useMemo(() => new Set(extraEntityKeys), [extraEntityKeys]);

  const pinCompetitor = useCallback((key: string) => {
    setEntityKey(key);
    if (key === "you") return;
    if (baseEntities.some((e) => e.key === key)) return;
    setExtraEntityKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
  }, [baseEntities]);

  const removeCompetitor = useCallback((key: string) => {
    setExtraEntityKeys((prev) => prev.filter((k) => k !== key));
    setEntityKey((current) => (current === key ? "you" : current));
  }, []);

  async function runFullAudit() {
    setAuditRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/growth-audit/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Audit failed");
      window.location.href = `/businesses/${businessId}/growth-audit`;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Audit failed");
      setAuditRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-red-600">{error ?? "No data"}</p>;
  }

  const selected = data.listings.find((l) => l.id === selectedId) ?? data.listings[0];
  const competitorCount = Math.max(data.listings.length - 1, 0);
  const gridSize = Number(data.latestScan?.grid_size ?? 7);
  const radiusMeters = Number(data.latestScan?.radius_meters ?? DEFAULT_RADIUS_METERS);
  const radiusRingMiles = gridRingDistancesMiles(gridSize, radiusMeters);
  const rankByDistance = computeGridRankByDistance(
    gridCells.map((c) => {
      const { row, col } = parseGridLabel(c.label);
      return { row, col, rank: c.rank, notInResults: c.notInResults };
    }),
    gridSize,
    radiusMeters
  );

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {error ? (
        <p className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="rounded-lg bg-surface-subtle px-3 py-1.5 text-sm dark:bg-zinc-900">
          <span className="text-text-muted">Keyword:</span> {data.keyword?.trim() || "—"}
        </div>
        <div className="rounded-lg bg-surface-subtle px-3 py-1.5 text-sm dark:bg-zinc-900">
          <span className="text-text-muted">Market:</span> {[data.city, data.state].filter(Boolean).join(", ") || "—"}
        </div>
        <Link
          href={`/businesses/${businessId}/scans`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-surface-subtle dark:border-zinc-700"
        >
          <Grid3X3 className="h-4 w-4" />
          Run Scan
        </Link>
        <button
          type="button"
          disabled={auditRunning}
          onClick={() => void runFullAudit()}
          className="ml-auto inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {auditRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Run Full Growth Audit
        </button>
      </div>

      <div className="grid gap-4 border-b border-border bg-surface-subtle px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900/50 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Growth Score" value={growthScore != null ? `${growthScore}/100` : "—"} />
        <MetricCard label="Competitors" value={competitorCount} />
        <MetricCard label="Grid Size" value={data.latestScan?.grid_size ? `${data.latestScan.grid_size}×${data.latestScan.grid_size}` : "—"} />
        <MetricCard label="Latest Scan" value={data.latestScan?.id ? "Ready" : "None"} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="max-h-56 w-full shrink-0 overflow-y-auto border-b border-border bg-surface-subtle lg:max-h-none lg:w-72 lg:border-b-0 lg:border-r dark:border-zinc-800 dark:bg-zinc-950">
          <p className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
            {competitorCount} competitors + your business
          </p>
          {data.listings.map((listing) => (
            <button
              key={listing.id}
              type="button"
              onClick={() => setSelectedId(listing.id)}
              className={cn(
                "w-full border-b border-border px-4 py-3 text-left transition dark:border-zinc-800",
                selectedId === listing.id ? "bg-white dark:bg-zinc-900" : "hover:bg-white/70 dark:hover:bg-zinc-900/50"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold leading-tight">{listing.name}</p>
                {listing.isTarget && (
                  <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                    YOU
                  </span>
                )}
                {!listing.isTarget && listing.rank != null && (
                  <span className="shrink-0 text-xs text-text-muted">#{listing.rank}</span>
                )}
              </div>
              <p className="mt-1 text-xs text-text-muted">{listing.category ?? "—"}</p>
              <p className="mt-0.5 text-xs text-text-muted">
                {listing.rating ?? "—"} ★ · {listing.reviewCount ?? 0} reviews
              </p>
            </button>
          ))}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {scanId && data.latestScan?.grid_size && (
            <div className="border-b border-border p-3 dark:border-zinc-800">
              <GridToolbar
                businessId={businessId}
                scanId={scanId}
                gridSize={data.latestScan.grid_size}
                radiusMeters={8047}
                selectedKeywordId={keywordId}
                selectedLocationId={null}
                onKeywordChange={(kwId, newScanId) => {
                  setKeywordId(kwId);
                  if (newScanId) setScanId(newScanId);
                }}
                onLocationChange={(_loc, newScanId) => {
                  if (newScanId) setScanId(newScanId);
                }}
                onScanStarted={(id) => setScanId(id)}
              />
              {entities.length > 0 && (
                <CompetitorGridToggle
                  entities={entities}
                  selectedKey={entityKey}
                  onSelect={pinCompetitor}
                  addPool={pickerPool}
                  onAdd={pinCompetitor}
                  removableKeys={removableKeys}
                  onRemove={removeCompetitor}
                  className="mt-2"
                />
              )}
              {gridMetrics && (
                <p className="mt-2 text-xs text-text-muted">
                  SoLV {gridMetrics.solv}% · avg rank #{gridMetrics.avgRank ?? "—"}
                </p>
              )}
              {scanId && (
                <ScanTimelineSlider
                  businessId={businessId}
                  currentScanId={scanId}
                  keywordId={keywordId}
                  onScanSelect={(id) => setScanId(id)}
                  className="mt-3"
                />
              )}
              <label className="mt-2 inline-flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={showRadiusRings}
                  onChange={(e) => setShowRadiusRings(e.target.checked)}
                />
                {gridRingCheckboxLabel(gridSize, radiusMeters)}
              </label>
            </div>
          )}
          <div className="relative min-h-[240px] flex-1">
            <ScanMap
              officeCenter={data.center}
              cells={gridCells}
              businessName={data.gbp?.name}
              height="100%"
              colorMode={colorMode}
              onCellClick={(cell) => cell.pointId && setInspectorCellId(cell.pointId)}
              showRadiusRings={showRadiusRings}
              radiusCenter={data.center}
              radiusRingMiles={radiusRingMiles}
              gridSize={gridSize}
              radiusMeters={radiusMeters}
            />
          </div>
          {gridCells.length > 0 && (
            <div className="border-t border-border px-3 py-2 dark:border-zinc-800">
              <GridRankLegend mode={colorMode} onModeChange={setColorMode} />
              {showRadiusRings && <RankByDistanceCard buckets={rankByDistance} />}
            </div>
          )}

          <div className="max-h-[40vh] shrink-0 overflow-y-auto border-t border-border bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
            {selected && (
              <div>
                <h2 className="text-lg font-bold">{selected.name}</h2>
                <p className="mt-1 text-sm text-text-muted">
                  {selected.rating ?? "—"} ★ ({selected.reviewCount ?? 0}) · {selected.category ?? "—"}
                </p>
                {selected.address && <p className="mt-1 text-sm">{selected.address}</p>}
              </div>
            )}

            {topTasks.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Latest Growth Tasks</h3>
                  <Link
                    href={`/businesses/${businessId}/growth-audit?tab=growth-plan`}
                    className="text-xs text-primary hover:underline"
                  >
                    View all →
                  </Link>
                </div>
                <ul className="mt-2 space-y-2">
                  {topTasks.map((t) => (
                    <li key={t.title} className="rounded-lg border border-border px-3 py-2 text-sm dark:border-zinc-800">
                      <span className="font-medium">{t.title}</span>
                      <span className="ml-2 text-xs uppercase text-text-muted">{t.priority}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!topTasks.length && (
              <div className="mt-4 rounded-xl border border-dashed border-border p-6 text-center dark:border-zinc-700">
                <p className="text-sm text-text-muted">No growth audit yet.</p>
                <Link
                  href={`/businesses/${businessId}/growth-audit`}
                  className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  <Play className="h-3.5 w-3.5" />
                  Run Full Growth Audit
                </Link>
              </div>
            )}

            {data.latestScan?.id && (
              <div className="mt-4 text-xs text-text-muted">
                Scan history:{" "}
                <Link href={`/businesses/${businessId}/grid/${data.latestScan.id}`} className="text-primary hover:underline">
                  View latest grid →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {scanId && (
        <CellInspectorDrawer
          scanId={scanId}
          cellId={inspectorCellId}
          keywordId={keywordId}
          businessId={businessId}
          onClose={() => setInspectorCellId(null)}
        />
      )}
    </div>
  );
}
