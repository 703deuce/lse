"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  BarChart3,
  Calendar,
  Download,
  Link2,
  Loader2,
  Lock,
  Plus,
  Share2,
  Shield,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useCompareActive } from "@/components/dashboard/dashboard-context";
import { rankLabel } from "@/lib/maps/grid-metrics";
import { gridScanMeta } from "@/lib/maps/grid-metrics";
import { legendItems, type GridColorMode } from "@/lib/maps/colors";
import type { CellComparison, CompareSummary } from "@/lib/maps/grid-entity";
import type { EntityOption } from "@/components/scan/competitor-grid-toggle";
import { GridCompareCellTable } from "@/components/scan/grid-compare-cell-table";
import { GridCompareInsights } from "@/components/scan/grid-compare-insights";
import {
  compareCardClass,
  compareHeaderBtn,
  comparePageBg,
  comparePrimaryBtn,
  compareSelectClass,
  compareFieldLabel,
} from "@/components/scan/grid-compare-ui";
import { GridMetricCard } from "@/components/ui/metric-card";
import { cn } from "@/lib/utils";

const ScanMap = dynamic(
  () => import("@/components/maps/scan-map").then((m) => m.ScanMap),
  { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-lg bg-zinc-100" /> }
);

type ScanOption = {
  id: string;
  label: string;
  createdAt: string;
  keyword?: string;
};

type CompareData = {
  mode: "scans" | "competitors";
  scanA: {
    id: string;
    keyword?: { keyword: string } | null;
    createdAt: string;
    finishedAt?: string | null;
    gridSize: number;
    radiusMeters: number;
  };
  scanB: {
    id: string;
    keyword?: { keyword: string } | null;
    createdAt: string;
    finishedAt?: string | null;
    gridSize: number;
    radiusMeters: number;
  };
  entityA: { key: string; label: string; isTarget?: boolean };
  entityB: { key: string; label: string; isTarget?: boolean };
  entities: EntityOption[];
  cells: CellComparison[];
  summary: CompareSummary;
};

type CompareMode = "scans" | "competitors";

interface GridCompareViewProps {
  businessId: string;
  currentScanId: string;
  officeCenter: [number, number];
  colorMode?: GridColorMode;
  keywordId?: string | null;
  entities?: EntityOption[];
  businessName?: string;
  keyword?: string;
  device?: string;
  os?: string;
  browser?: string;
  initialMode?: CompareMode;
  initialCompetitorKey?: string | null;
  onClose: () => void;
}

const selectClass = compareSelectClass;

function formatScanDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function shortScanDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function scanMetaLine(
  gridSize: number,
  radiusMeters: number,
  device: string,
  os: string,
  browser: string
): string {
  const meta = gridScanMeta(gridSize, radiusMeters);
  return `Grid size (${gridSize}×${gridSize}) · Radius (${meta.radiusMiles} miles) · Device (${device}) · OS (${os}) · Browser (${browser})`;
}

export function GridCompareView({
  businessId,
  currentScanId,
  officeCenter,
  colorMode = "falcon",
  keywordId,
  entities: entitiesProp = [],
  businessName = "Your business",
  keyword: keywordProp,
  device = "Mobile",
  os = "Android",
  browser = "Chrome",
  initialMode = "scans",
  initialCompetitorKey = null,
  onClose,
}: GridCompareViewProps) {
  useCompareActive(true);
  const [mode, setMode] = useState<CompareMode>(initialMode);
  const [scans, setScans] = useState<ScanOption[]>([]);
  const [scanAId, setScanAId] = useState(currentScanId);
  const [scanBId, setScanBId] = useState("");
  const [competitorScanId, setCompetitorScanId] = useState(currentScanId);
  const [competitorKey, setCompetitorKey] = useState(initialCompetitorKey ?? "");
  const [data, setData] = useState<CompareData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [mapFitKey, setMapFitKey] = useState(0);
  const [syncMaps, setSyncMaps] = useState(true);
  const [resetViewKey, setResetViewKey] = useState(0);
  const [syncView, setSyncView] = useState<{ lat: number; lng: number; zoom: number } | null>(
    null
  );
  const [highlightedCell, setHighlightedCell] = useState<string | null>(null);
  const [tableFilter, setTableFilter] = useState<"all" | "improved" | "declined" | "unchanged">(
    "all"
  );
  const [error, setError] = useState<string | null>(null);
  const compareRequestRef = useRef(0);

  const competitorOptions =
    data?.entities?.filter((e) => !e.isTarget) ??
    entitiesProp.filter((e) => !e.isTarget);

  useEffect(() => {
    async function loadScans() {
      const res = await fetch(`/api/businesses/${businessId}/scans`);
      if (!res.ok) return;
      const json = await res.json();
      const options: ScanOption[] = (json.scans ?? []).map(
        (s: { id: string; created_at: string; keyword?: string }) => ({
          id: s.id,
          createdAt: s.created_at,
          label: formatScanDate(s.created_at),
          keyword: s.keyword,
        })
      );
      setScans(options);
      if (options.length > 1 && !scanBId) {
        const other = options.find((o) => o.id !== currentScanId);
        if (other) setScanBId(other.id);
      }
    }
    void loadScans();
  }, [businessId, currentScanId, scanBId]);

  useEffect(() => {
    const firstCompetitor =
      competitorOptions[0]?.key ??
      entitiesProp.find((e) => !e.isTarget)?.key ??
      "";
    if (firstCompetitor && !competitorKey) {
      setCompetitorKey(firstCompetitor);
    }
  }, [competitorOptions, competitorKey, entitiesProp]);

  const loadCompare = useCallback(async () => {
    const params = new URLSearchParams();
    if (mode === "competitors") {
      if (!competitorScanId || !competitorKey) return;
      params.set("scanA", competitorScanId);
      params.set("scanB", competitorScanId);
      params.set("entityA", "you");
      params.set("entityB", competitorKey);
      params.set("mode", "competitors");
    } else {
      if (!scanAId || !scanBId) return;
      params.set("scanA", scanAId);
      params.set("scanB", scanBId);
      params.set("entityA", "you");
      params.set("entityB", "you");
      params.set("mode", "scans");
    }
    if (keywordId) {
      params.set("keywordIdA", keywordId);
      params.set("keywordIdB", keywordId);
    }

    const requestId = ++compareRequestRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/scans/compare?${params}`);
      const json = await res.json();
      if (requestId !== compareRequestRef.current) return;
      if (!res.ok) throw new Error(json.error ?? "Compare failed");
      setData(json);
    } catch (e) {
      if (requestId !== compareRequestRef.current) return;
      setError(e instanceof Error ? e.message : "Compare failed");
      setData(null);
    } finally {
      if (requestId === compareRequestRef.current) setLoading(false);
    }
  }, [mode, scanAId, scanBId, competitorScanId, competitorKey, keywordId]);

  useEffect(() => {
    compareRequestRef.current += 1;
    setData(null);
    setError(null);
  }, [mode]);

  useEffect(() => {
    if (mode === "scans" && scanAId && scanBId) void loadCompare();
    if (mode === "competitors" && competitorScanId && competitorKey) void loadCompare();
  }, [mode, scanAId, scanBId, competitorScanId, competitorKey, loadCompare]);

  useEffect(() => {
    const t = window.setTimeout(() => setMapFitKey((k) => k + 1), 80);
    return () => window.clearTimeout(t);
  }, [showLegend]);

  const isCompetitorMode = data?.mode === "competitors";
  const summary = data?.summary;
  const gridSizeA = data?.scanA.gridSize ?? 7;
  const gridSizeB = data?.scanB.gridSize ?? 7;
  const radiusMetersA = data?.scanA.radiusMeters ?? 8047;
  const radiusMetersB = data?.scanB.radiusMeters ?? 8047;
  const gridSize = gridSizeB;
  const radiusMeters = radiusMetersB;
  const scansDifferInExtent =
    gridSizeA !== gridSizeB || radiusMetersA !== radiusMetersB;
  const syncZoom = !scansDifferInExtent;
  const deviceLabel = device.charAt(0).toUpperCase() + device.slice(1);
  const osLabel = os === "ios" ? "iOS (iPhone)" : os.charAt(0).toUpperCase() + os.slice(1);
  const browserLabel = browser.charAt(0).toUpperCase() + browser.slice(1);

  const cellsA = useMemo(
    () =>
      data?.cells.map((c) => ({
        label: c.label,
        lat: c.lat,
        lng: c.lng,
        rank: c.rankA,
        notInResults: c.rankA == null,
        delta: c.delta,
        direction: c.direction,
        dimmed: highlightedCell != null && highlightedCell !== c.label,
      })) ?? [],
    [data?.cells, highlightedCell]
  );

  const cellsB = useMemo(
    () =>
      data?.cells.map((c) => ({
        label: c.label,
        lat: c.lat,
        lng: c.lng,
        rank: c.rankB,
        notInResults: c.rankB == null,
        dimmed: highlightedCell != null && highlightedCell !== c.label,
      })) ?? [],
    [data?.cells, highlightedCell]
  );

  const matchedCells = data?.cells.length ?? 0;
  const dataCoverage =
    matchedCells > 0
      ? Math.round(
          ((matchedCells - (summary?.missingCells ?? 0)) / matchedCells) * 100
        )
      : 0;

  const baselineDate = data?.scanA.finishedAt ?? data?.scanA.createdAt;
  const currentDate = data?.scanB.finishedAt ?? data?.scanB.createdAt;

  const headerBtn = compareHeaderBtn;

  return (
    <div className={cn("fixed inset-y-0 right-0 left-60 z-50 flex min-h-screen", comparePageBg)}>
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="border-b border-zinc-200 bg-white px-4 py-2">
          <div className="flex flex-wrap items-start justify-between gap-2.5">
            <div>
              <h1 className="text-lg font-bold tracking-tight text-zinc-900">
                Compare Rank Grids
              </h1>
              <p className="mt-0.5 text-[12px] text-zinc-500">
                Rank movement and performance between two scans.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={headerBtn}>
                <Download className="h-3.5 w-3.5" />
                Export
              </button>
              <button type="button" className={headerBtn}>
                <Share2 className="h-3.5 w-3.5" />
                Share
              </button>
              <button type="button" className={headerBtn}>
                <Calendar className="h-3.5 w-3.5" />
                Schedule Report
              </button>
              <button
                type="button"
                onClick={onClose}
                className={comparePrimaryBtn}
              >
                <Plus className="h-3.5 w-3.5" />
                New Scan
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-2.5">
          {/* Mode tabs */}
          <div className="mb-3 inline-flex rounded-lg border border-zinc-200 bg-white p-0.5 shadow-sm">
            <button
              type="button"
              onClick={() => setMode("scans")}
              className={cn(
                "rounded-md px-3 py-1 text-[12px] font-medium transition-colors",
                mode === "scans"
                  ? "bg-[#137752] text-white shadow-sm"
                  : "border border-[#137752] bg-white text-[#137752]"
              )}
            >
              Over time
            </button>
            <button
              type="button"
              onClick={() => setMode("competitors")}
              className={cn(
                "rounded-md px-3 py-1 text-[12px] font-medium transition-colors",
                mode === "competitors"
                  ? "bg-[#137752] text-white shadow-sm"
                  : "border border-[#137752] bg-white text-[#137752]"
              )}
            >
              Vs competitor
            </button>
          </div>

          {/* Scan selection cards */}
          {mode === "scans" ? (
            <div className="mb-3 flex items-stretch gap-2">
              <ScanSelectCard
                sectionLabel="Earlier Scan"
                badge="Baseline"
                badgeVariant="filled"
                scanId={scanAId}
                scans={scans}
                keyword={data?.scanA.keyword?.keyword ?? keywordProp}
                entityLabel={businessName}
                metaLine={scanMetaLine(
                  data?.scanA.gridSize ?? gridSizeA,
                  data?.scanA.radiusMeters ?? radiusMetersA,
                  deviceLabel,
                  osLabel,
                  browserLabel
                )}
                onScanChange={setScanAId}
              />
              <div className="flex shrink-0 items-center px-1">
                <Link2 className="h-4 w-4 text-zinc-400" aria-hidden />
              </div>
              <ScanSelectCard
                sectionLabel="Later Scan"
                badge="Current"
                badgeVariant="outline"
                scanId={scanBId}
                scans={scans}
                keyword={data?.scanB.keyword?.keyword ?? keywordProp}
                entityLabel={businessName}
                metaLine={scanMetaLine(
                  data?.scanB.gridSize ?? gridSizeB,
                  data?.scanB.radiusMeters ?? radiusMetersB,
                  deviceLabel,
                  osLabel,
                  browserLabel
                )}
                onScanChange={setScanBId}
              />
            </div>
          ) : (
            <div className="mb-3 grid gap-2.5 lg:grid-cols-2">
              <ScanSelectCard
                sectionLabel="Your scan"
                badge="Baseline"
                badgeVariant="filled"
                scanId={competitorScanId}
                scans={scans}
                keyword={data?.scanA.keyword?.keyword ?? keywordProp}
                entityLabel={businessName}
                metaLine={scanMetaLine(gridSize, radiusMeters, deviceLabel, osLabel, browserLabel)}
                onScanChange={setCompetitorScanId}
              />
              <div className={cn(compareCardClass, "p-3")}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[12px] font-semibold text-zinc-900">Competitor scan</p>
                  <span className="inline-flex shrink-0 rounded-full border border-emerald-300 bg-white px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                    Current
                  </span>
                </div>
                <label className="mt-2 block">
                  <span className={compareFieldLabel}>Competitor</span>
                  <select
                    className={selectClass}
                    value={competitorKey}
                    onChange={(e) => setCompetitorKey(e.target.value)}
                  >
                    {competitorOptions.length === 0 ? (
                      <option value="">No competitors</option>
                    ) : (
                      competitorOptions.map((e) => (
                        <option key={e.key} value={e.key}>
                          {e.label}
                        </option>
                      ))
                    )}
                  </select>
                </label>
                <p className="mt-2 text-[11px] leading-snug text-zinc-500">
                  Side-by-side: your grid vs theirs on the same scan
                </p>
              </div>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center gap-2 py-12 text-zinc-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Comparing scans…
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
              {error}
            </p>
          )}

          {summary && !loading && data && (
            <>
              {/* KPI row */}
              <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7">
                <GridMetricCard
                  compact
                  label="Avg Rank Δ"
                  value={
                    isCompetitorMode
                      ? `#${rankLabel(summary.avgRankA)}`
                      : summary.avgRankDelta != null
                        ? `${summary.avgRankDelta > 0 ? "+" : ""}${summary.avgRankDelta}`
                        : "—"
                  }
                  sub={
                    isCompetitorMode
                      ? "Your average"
                      : summary.avgRankDelta != null
                        ? `↑ ${Math.abs(summary.avgRankDelta)} vs baseline`
                        : undefined
                  }
                  icon={BarChart3}
                  iconWrapClassName="bg-emerald-50"
                  iconClassName="text-emerald-600"
                  trendPositive={
                    !isCompetitorMode && summary.avgRankDelta != null
                      ? summary.avgRankDelta > 0
                      : undefined
                  }
                />
                <GridMetricCard
                  compact
                  label="SOV Δ"
                  value={
                    isCompetitorMode
                      ? `${summary.solvA}%`
                      : `${summary.solvDelta >= 0 ? "+" : ""}${summary.solvDelta}%`
                  }
                  sub={
                    isCompetitorMode
                      ? "Your SoLV"
                      : `↑ ${Math.abs(summary.solvDelta)}% vs baseline`
                  }
                  icon={Target}
                  iconWrapClassName="bg-emerald-50"
                  iconClassName="text-emerald-600"
                  trendPositive={!isCompetitorMode ? summary.solvDelta >= 0 : undefined}
                />
                <GridMetricCard
                  compact
                  label="Top 3 Δ"
                  value={
                    isCompetitorMode
                      ? summary.top3CellsA
                      : `${summary.top3Delta >= 0 ? "+" : ""}${summary.top3Delta}`
                  }
                  sub={
                    isCompetitorMode
                      ? "Your top 3 cells"
                      : `↑ ${summary.top3Delta} vs baseline`
                  }
                  icon={TrendingUp}
                  iconWrapClassName="bg-blue-50"
                  iconClassName="text-blue-600"
                  trendPositive={!isCompetitorMode ? summary.top3Delta >= 0 : undefined}
                />
                <GridMetricCard
                  compact
                  label="Improved cells"
                  value={summary.improvedCells}
                  sub={`↑ ${summary.improvedCells} cells`}
                  icon={TrendingUp}
                  iconWrapClassName="bg-emerald-50"
                  iconClassName="text-emerald-600"
                  trendPositive
                />
                <GridMetricCard
                  compact
                  label="Declined cells"
                  value={summary.declinedCells}
                  sub={`↓ ${summary.declinedCells} cells`}
                  icon={TrendingDown}
                  iconWrapClassName="bg-red-50"
                  iconClassName="text-red-600"
                  trendPositive={false}
                />
                <GridMetricCard
                  compact
                  label="Unchanged cells"
                  value={summary.unchangedCells}
                  sub={`— ${summary.unchangedCells} cells`}
                  icon={Lock}
                  iconWrapClassName="bg-zinc-100"
                  iconClassName="text-zinc-500"
                />
                <GridMetricCard
                  compact
                  label="Data coverage"
                  value={`${dataCoverage}%`}
                  sub={`${matchedCells - (summary.missingCells ?? 0)} / ${matchedCells} cells matched`}
                  icon={Shield}
                  iconWrapClassName="bg-emerald-50"
                  iconClassName="text-emerald-600"
                />
              </div>

              <div className="space-y-3">
                <div className="grid gap-3 xl:grid-cols-12">
                  <div className="space-y-2.5 xl:col-span-9">
                    <div
                      className={cn(
                        "grid items-stretch gap-2",
                        showLegend ? "lg:grid-cols-[1fr_auto_1fr]" : "lg:grid-cols-2"
                      )}
                    >
                      <CompareMapPanel
                        title="Baseline"
                        subtitle={baselineDate ? formatScanDate(baselineDate) : ""}
                        officeCenter={officeCenter}
                        cells={cellsA}
                        colorMode={colorMode}
                        showDelta
                        gridSize={gridSizeA}
                        radiusMeters={radiusMetersA}
                        businessName={data.entityA.label}
                        syncEnabled={syncMaps}
                        syncZoom={syncZoom}
                        syncView={syncView}
                        onSyncViewChange={setSyncView}
                        resetViewKey={resetViewKey + mapFitKey}
                        onCellHover={setHighlightedCell}
                      />
                      {showLegend && (
                        <div className="hidden shrink-0 self-center lg:block">
                          <CompareMapLegend
                            improved={summary.improvedCells}
                            unchanged={summary.unchangedCells}
                            declined={summary.declinedCells}
                            colorMode={colorMode}
                          />
                        </div>
                      )}
                      <CompareMapPanel
                        title="Current"
                        subtitle={currentDate ? formatScanDate(currentDate) : ""}
                        officeCenter={officeCenter}
                        cells={cellsB}
                        colorMode={colorMode}
                        showDelta={false}
                        gridSize={gridSizeB}
                        radiusMeters={radiusMetersB}
                        businessName={data.entityB.label}
                        syncEnabled={syncMaps}
                        syncZoom={syncZoom}
                        syncView={syncView}
                        onSyncViewChange={setSyncView}
                        resetViewKey={resetViewKey + mapFitKey}
                        onCellHover={setHighlightedCell}
                      />
                    </div>

                    <div className={cn(compareCardClass, "flex flex-wrap items-center justify-between gap-2 px-3 py-2")}>
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="inline-flex items-center gap-1.5 text-[11px] text-zinc-600">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={syncMaps}
                            onClick={() => setSyncMaps((v) => !v)}
                            className={cn(
                              "relative h-5 w-9 rounded-full transition-colors",
                              syncMaps ? "bg-[#137752]" : "bg-zinc-300"
                            )}
                          >
                            <span
                              className={cn(
                                "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                                syncMaps ? "left-[18px]" : "left-0.5"
                              )}
                            />
                          </button>
                          <Link2 className="h-3 w-3 text-zinc-400" />
                          Synchronized maps
                        </label>
                        <label className="inline-flex items-center gap-1.5 text-[11px] text-zinc-600">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={showLegend}
                            onClick={() => setShowLegend((v) => !v)}
                            className={cn(
                              "relative h-5 w-9 rounded-full transition-colors",
                              showLegend ? "bg-[#137752]" : "bg-zinc-300"
                            )}
                          >
                            <span
                              className={cn(
                                "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                                showLegend ? "left-[18px]" : "left-0.5"
                              )}
                            />
                          </button>
                          Show legend
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={() => setResetViewKey((k) => k + 1)}
                        className="text-[11px] font-medium text-zinc-600 hover:text-zinc-900"
                      >
                        Reset view
                      </button>
                    </div>
                  </div>

                  <div className="xl:col-span-3">
                    <GridCompareInsights
                      cells={data.cells}
                      headToHead={isCompetitorMode}
                      onViewAllGains={() => setTableFilter("improved")}
                      onViewAllLosses={() => setTableFilter("declined")}
                    />
                  </div>
                </div>

                <GridCompareCellTable
                  key={tableFilter}
                  cells={data.cells}
                  baselineLabel={isCompetitorMode ? data.entityA.label : "Baseline"}
                  currentLabel={isCompetitorMode ? data.entityB.label : "Current"}
                  baselineDate={baselineDate ? shortScanDate(baselineDate) : undefined}
                  currentDate={currentDate ? shortScanDate(currentDate) : undefined}
                  headToHead={isCompetitorMode}
                  highlightedCell={highlightedCell}
                  onHighlightCell={setHighlightedCell}
                  initialFilter={tableFilter}
                />
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function ScanSelectCard({
  sectionLabel,
  badge,
  badgeVariant = "filled",
  scanId,
  scans,
  keyword,
  entityLabel,
  metaLine,
  onScanChange,
}: {
  sectionLabel?: string;
  badge: string;
  badgeVariant?: "filled" | "outline";
  scanId: string;
  scans: ScanOption[];
  keyword?: string;
  entityLabel: string;
  metaLine: string;
  onScanChange: (id: string) => void;
}) {
  return (
    <div className={cn(compareCardClass, "min-w-0 flex-1 p-3")}>
      <div className="flex items-start justify-between gap-2">
        {sectionLabel ? (
          <p className="text-[12px] font-semibold text-zinc-900">{sectionLabel}</p>
        ) : (
          <span />
        )}
        <span
          className={cn(
            "inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            badgeVariant === "outline"
              ? "border border-emerald-300 bg-white text-emerald-700"
              : "bg-[#137752] text-white"
          )}
        >
          {badge}
        </span>
      </div>
      <label className="mt-2 block">
        <div className="relative">
          <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <select
            className={cn(selectClass, "pl-8")}
            value={scanId}
            onChange={(e) => onScanChange(e.target.value)}
          >
            {scans.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </label>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label>
          <span className={compareFieldLabel}>Keyword</span>
          <select className={cn(selectClass, "bg-zinc-50")} value={keyword ?? ""} disabled>
            <option value={keyword ?? ""}>{keyword ?? "—"}</option>
          </select>
        </label>
        <label>
          <span className={compareFieldLabel}>Business</span>
          <select className={cn(selectClass, "bg-zinc-50")} value={entityLabel} disabled>
            <option value={entityLabel}>{entityLabel}</option>
          </select>
        </label>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-zinc-500">{metaLine}</p>
    </div>
  );
}

function CompareMapPanel({
  title,
  subtitle,
  officeCenter,
  cells,
  colorMode,
  showDelta,
  gridSize,
  radiusMeters,
  businessName,
  syncEnabled,
  syncZoom = true,
  syncView,
  onSyncViewChange,
  resetViewKey,
  onCellHover,
}: {
  title: string;
  subtitle: string;
  officeCenter: [number, number];
  cells: Array<{
    label: string;
    lat: number;
    lng: number;
    rank: number | null;
    notInResults?: boolean;
    delta?: number | null;
    direction?: CellComparison["direction"];
    dimmed?: boolean;
  }>;
  colorMode: GridColorMode;
  showDelta: boolean;
  gridSize: number;
  radiusMeters: number;
  businessName: string;
  syncEnabled: boolean;
  syncZoom?: boolean;
  syncView: { lat: number; lng: number; zoom: number } | null;
  onSyncViewChange?: (view: { lat: number; lng: number; zoom: number }) => void;
  resetViewKey: number;
  onCellHover: (label: string | null) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div
        className="relative min-h-[240px] flex-1"
        onMouseLeave={() => onCellHover(null)}
      >
        <ScanMap
          officeCenter={officeCenter}
          cells={cells}
          businessName={businessName}
          colorMode={colorMode}
          height="min(38vh, 340px)"
          showDeltaOverlay={showDelta}
          gridSize={gridSize}
          radiusMeters={radiusMeters}
          syncEnabled={syncEnabled}
          syncZoom={syncZoom}
          syncView={syncView}
          onSyncViewChange={onSyncViewChange}
          resetViewKey={resetViewKey}
          onCellClick={(c) => onCellHover(c.label)}
        />
      </div>
      <div className="border-t border-zinc-100 px-3 py-1.5 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{title}</p>
        <p className="text-[11px] font-medium text-zinc-700">{subtitle}</p>
      </div>
    </div>
  );
}

function CompareMapLegend({
  improved,
  unchanged,
  declined,
  colorMode,
}: {
  improved: number;
  unchanged: number;
  declined: number;
  colorMode: GridColorMode;
}) {
  const items = legendItems(colorMode);

  return (
    <div className="w-32 rounded-lg border border-zinc-200 bg-white p-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        Delta (change)
      </p>
      <ul className="mt-2 space-y-1 text-[11px]">
        <li className="flex items-center justify-between text-emerald-700">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Improved
          </span>
          <span className="font-semibold">{improved}</span>
        </li>
        <li className="flex items-center justify-between text-zinc-600">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-zinc-400" />
            Unchanged
          </span>
          <span className="font-semibold">{unchanged}</span>
        </li>
        <li className="flex items-center justify-between text-red-600">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            Declined
          </span>
          <span className="font-semibold">{declined}</span>
        </li>
      </ul>
      <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        Rank legend
      </p>
      <ul className="mt-1.5 space-y-0.5">
        {items.slice(0, 6).map((item) => (
          <li key={item.label} className="flex items-center gap-1.5 text-[10px] text-zinc-600">
            <span
              className="h-2.5 w-2.5 rounded-full border border-white shadow-sm"
              style={{ background: item.hex }}
            />
            {item.label}
          </li>
        ))}
        <li className="flex items-center gap-1.5 text-[10px] text-zinc-600">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
          20+
        </li>
        <li className="flex items-center gap-1.5 text-[10px] text-zinc-600">
          <span className="h-2.5 w-2.5 rounded-full border border-zinc-300 bg-zinc-700" />
          Not found
        </li>
      </ul>
    </div>
  );
}
