"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  BarChart3,
  Crosshair,
  Eye,
  GitCompare,
  Loader2,
  MapPinned,
  Target,
  TrendingDown,
} from "lucide-react";
import { createBrowserClient } from "@/lib/db/client";
import { GridMetricCard, GridTopCellsGroup, KpiRow, StatusBadge } from "@/components/ui/metric-card";
import {
  gridRankHeaderBtn,
  gridRankPageBg,
  gridRankWorkspaceClass,
} from "@/components/scan/grid-rank-ui";
import { computeScanTrend, buildGridTopCompetitors, type ScanAggregateMetrics } from "@/lib/maps/grid";
import { computeSolv, computeWeightedSolv, gridScanMeta } from "@/lib/maps/grid-metrics";
import { GRID_COLOR_MODE_STORAGE_KEY, type GridColorMode } from "@/lib/maps/colors";
import { GridRankLegend } from "@/components/maps/grid-rank-legend";
import { profileFromBatch } from "@/lib/maps/scan-profiles";
import {
  buildEntityGridCells,
  buildYouEntity,
  entitiesFromTopCompetitors,
  entityFromKey,
  metricsFromCells,
  solvFromCells,
  type StoredCompetitor,
} from "@/lib/maps/grid-entity";
import { CellInspectorDrawer } from "@/components/scan/cell-inspector-drawer";
import {
  CompetitorGridToggle,
  type CompetitorAddOption,
  type EntityOption,
} from "@/components/scan/competitor-grid-toggle";
import {
  areCellsInFlight,
  hasCellsPending,
  hasTrailingCellsSettling,
  isEnrichmentRunning,
  isScanMapReady,
  scanProgressMessage,
  scanWaitPhase,
  shouldPollUntilMapReady,
} from "@/lib/scans/status";
import { RankByDistanceCard } from "@/components/maps/rank-by-distance-card";
import { OpenReportWithStagingLink } from "@/components/journey/journey-actions";
import { ScanTimelineSlider, type TimelineMode } from "@/components/scan/scan-timeline-slider";
import { computeGridRankByDistance } from "@/lib/maps/rank-by-distance";
import { entityKeyFromParts } from "@/lib/maps/grid-entity";
import { GridCompareView } from "@/components/scan/grid-compare-view";
import { GridScanTrendChart } from "@/components/scan/grid-scan-trend-chart";
import { GridScanCompetitorsTable } from "@/components/scan/grid-scan-competitors-table";
import { MoveGridPanel, useMoveGridPreview } from "@/components/scan/move-grid-panel";
import {
  SinglePointConfirmModal,
  SpotCheckInspector,
  type SpotCheckDetail,
  type SpotCheckMarker,
} from "@/components/scan/single-point-check";
import type { MapInteractionMode } from "@/components/maps/scan-map";
import type { GridCell } from "@/components/maps/scan-map";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ScanExportMenu } from "@/components/reports/scan-export-menu";
import { CancelScanButton } from "@/components/scan/cancel-active-scans-button";

const ScanMap = dynamic(
  () => import("@/components/maps/scan-map").then((m) => m.ScanMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[min(68vh,600px)] items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    ),
  }
);

const isDev = process.env.NODE_ENV === "development";

/** Auto-pin top pack competitors as grid chips. */
const AUTO_COMPETITOR_CHIPS = 5;
/** Full add-from-scan pool (picker + table selection). */
const COMPETITOR_POOL_LIMIT = 20;

type ScanViewData = {
  batch: Record<string, unknown>;
  business: {
    name?: string;
    cid?: string | null;
    place_id?: string | null;
    phone?: string | null;
    website_url?: string | null;
    lat?: number | null;
    lng?: number | null;
    scan_center_lat?: number | null;
    scan_center_lng?: number | null;
    primary_category?: string | null;
  } | null;
  primaryKeyword?: string | null;
  primaryKeywordId?: string | null;
  scanKeywordId?: string | null;
  primaryKeywordCity?: string | null;
  primaryKeywordState?: string | null;
  points: Array<Record<string, unknown>>;
  results: Array<Record<string, unknown>>;
  priorMetrics: Record<string, unknown> | null;
};

const scanDataCache = new Map<string, ScanViewData>();

function scanCacheKey(scanId: string, keywordId: string | null) {
  return `${scanId}:${keywordId ?? ""}`;
}

/** Next.js 16 patches replaceState and syncs the App Router — use __NA to update the URL without remounting. */
function replaceUrlWithoutRouterSync(url: string) {
  window.history.replaceState({ __NA: true }, "", url);
}

export function GridScanView({
  businessId,
  scanId,
  initialCompareScanId = null,
}: {
  businessId: string;
  scanId: string;
  /** When set (e.g. from campaign Compare period), open compare with this baseline scan. */
  initialCompareScanId?: string | null;
}) {
  const [activeScanId, setActiveScanId] = useState(scanId);
  const [colorMode, setColorMode] = useState<GridColorMode>("falcon");
  const [keywordId, setKeywordId] = useState<string | null>(null);
  const [entityKey, setEntityKey] = useState("you");
  /** User-pinned competitors beyond the auto top chips. */
  const [extraEntityKeys, setExtraEntityKeys] = useState<string[]>([]);
  const [inspectorCellId, setInspectorCellId] = useState<string | null>(null);
  const [compareOpen, setCompareOpen] = useState(Boolean(initialCompareScanId));
  const [compareInitialMode, setCompareInitialMode] = useState<"scans" | "competitors">("scans");
  const [compareInitialCompetitorKey, setCompareInitialCompetitorKey] = useState<string | null>(null);
  const [compareInitialScanAId] = useState<string | null>(initialCompareScanId);
  const [showRadiusRings, setShowRadiusRings] = useState(false);
  const [timelineMode, setTimelineMode] = useState<TimelineMode>("target");
  const [timelineCompetitorKey, setTimelineCompetitorKey] = useState<string | null>(null);
  const [locationId] = useState<string | null>(null);
  const [moveGridActive, setMoveGridActive] = useState(false);
  const [previewCenter, setPreviewCenter] = useState<[number, number] | null>(null);
  const [moveScanRunning, setMoveScanRunning] = useState(false);
  const [singlePointActive, setSinglePointActive] = useState(false);
  const [pendingClick, setPendingClick] = useState<{ lat: number; lng: number } | null>(null);
  const [spotChecks, setSpotChecks] = useState<SpotCheckMarker[]>([]);
  const [spotCheckDetails, setSpotCheckDetails] = useState<Record<string, SpotCheckDetail>>({});
  const [activeSpotCheckId, setActiveSpotCheckId] = useState<string | null>(null);
  const [singlePointRunning, setSinglePointRunning] = useState(false);
  const [timelineFetching, setTimelineFetching] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [data, setData] = useState<ScanViewData | null>(
    () => scanDataCache.get(scanCacheKey(scanId, null)) ?? null
  );
  /** Progress bar must never go backwards (retry passes used to rewind the counter). */
  const [peakProgress, setPeakProgress] = useState(0);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(GRID_COLOR_MODE_STORAGE_KEY);
      if (stored === "strict" || stored === "falcon") setColorMode(stored);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    setActiveScanId(scanId);
    setPeakProgress(0);
    setEntityKey("you");
    setExtraEntityKeys([]);
    if (typeof window !== "undefined") {
      const kw = new URLSearchParams(window.location.search).get("keywordId");
      if (kw) setKeywordId(kw);
    }
  }, [scanId]);

  const replaceGridUrl = useCallback(
    (nextScanId: string, nextKeywordId?: string | null) => {
      if (typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);
      const kw = nextKeywordId !== undefined ? nextKeywordId : keywordId;
      if (kw) params.set("keywordId", kw);
      else params.delete("keywordId");
      const qs = params.toString();
      const path = `/businesses/${businessId}/grid/${nextScanId}${qs ? `?${qs}` : ""}`;
      replaceUrlWithoutRouterSync(path);
    },
    [businessId, keywordId]
  );

  const prefetchScanData = useCallback(
    (scanId: string, kw?: string | null) => {
      const resolvedKw = kw !== undefined ? kw : keywordId;
      const key = scanCacheKey(scanId, resolvedKw);
      if (scanDataCache.has(key)) return;
      const params = resolvedKw ? `?keywordId=${resolvedKw}` : "";
      void fetch(`/api/scans/${scanId}/status${params}`)
        .then((res) => res.json())
        .then((json: ScanViewData) => {
          scanDataCache.set(key, json);
        })
        .catch(() => undefined);
    },
    [keywordId]
  );

  const switchScan = useCallback(
    (nextScanId: string, nextKeywordId?: string | null) => {
      const resolvedKeywordId = nextKeywordId !== undefined ? nextKeywordId : keywordId;
      if (nextScanId === activeScanId && nextKeywordId === undefined) return;
      if (nextKeywordId !== undefined) setKeywordId(nextKeywordId);
      setInspectorCellId(null);
      setCompareOpen(false);
      const cacheKey = scanCacheKey(nextScanId, resolvedKeywordId);
      const cached = scanDataCache.get(cacheKey);
      if (cached) {
        setData(cached);
        setTimelineFetching(false);
      } else {
        setTimelineFetching(true);
        setData(null);
        const params = resolvedKeywordId ? `?keywordId=${resolvedKeywordId}` : "";
        void fetch(`/api/scans/${nextScanId}/status${params}`)
          .then((res) => res.json())
          .then((json: ScanViewData) => {
            scanDataCache.set(cacheKey, json);
            setData(json);
            setTimelineFetching(false);
          })
          .catch(() => setTimelineFetching(false));
      }
      setActiveScanId(nextScanId);
      replaceGridUrl(nextScanId, nextKeywordId);
    },
    [activeScanId, keywordId, replaceGridUrl]
  );

  function handleColorModeChange(mode: GridColorMode) {
    setColorMode(mode);
    try {
      localStorage.setItem(GRID_COLOR_MODE_STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  }

  const pollStatus = useCallback(async (signal?: AbortSignal) => {
    const params = keywordId ? `?keywordId=${keywordId}` : "";
    const res = await fetch(`/api/scans/${activeScanId}/status${params}`, { signal });
    const json = await res.json();
    if (!res.ok) {
      throw new Error((json as { error?: string }).error ?? `Status ${res.status}`);
    }
    return json;
  }, [activeScanId, keywordId]);

  useEffect(() => {
    let active = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let inFlight = false;
    const abort = new AbortController();
    const supabase = createBrowserClient();

    function scheduleNext(ms: number) {
      if (!active) return;
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        void poll();
      }, ms);
    }

    async function poll() {
      if (!active || inFlight) return;
      // Pause while the tab is hidden — resume on visibilitychange below.
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        scheduleNext(5000);
        return;
      }
      inFlight = true;
      try {
        const json = (await pollStatus(abort.signal)) as ScanViewData;
        if (!active) return;
        scanDataCache.set(scanCacheKey(activeScanId, keywordId), json);
        setData(json);
        setTimelineFetching(false);
        const conf = (json.batch?.confidence_summary ?? {}) as Record<string, unknown>;
        // Peak latches cells_completed only (not results.length) — failed cells can
        // already have a sparse row while retries are still running.
        const settled = Math.max(
          Number(json.batch?.cells_completed ?? 0),
          Number(conf.completed_cells ?? 0)
        );
        setPeakProgress((prev) => Math.max(prev, settled));
        // Do not setKeywordId from poll results — remounting this effect (keywordId dep)
        // can abort the poll that would have revealed the finished map.
        const status = json.batch?.status as string;
        const batchPoll = {
          status,
          cells_completed: json.batch?.cells_completed as number | null | undefined,
          cells_total: json.batch?.cells_total as number | null | undefined,
          cells_failed: json.batch?.cells_failed as number | null | undefined,
          finished_at: (json.batch?.finished_at as string | null | undefined) ?? null,
          rank_ready_at: (json.batch?.rank_ready_at as string | null | undefined) ?? null,
          confidence_summary: (json.batch?.confidence_summary ?? null) as Record<
            string,
            unknown
          > | null,
        };
        const pointsLen = json.points?.length ?? 0;
        const resultsLen = json.results?.length ?? 0;
        // Same condition as the wait UI: never stop until the map is ready to show.
        if (shouldPollUntilMapReady(batchPoll, resultsLen, pointsLen)) {
          scheduleNext(areCellsInFlight(status) ? 1500 : 2000);
        }
      } catch (err) {
        if (!active) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        scheduleNext(3000);
      } finally {
        inFlight = false;
      }
    }

    void poll();

    const onVisibility = () => {
      if (document.visibilityState === "visible" && active && !inFlight) {
        void poll();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const channel = supabase
      .channel(`scan-${activeScanId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "scan_batches", filter: `id=eq.${activeScanId}` },
        () => {
          // Coalesce with timer poll — skip if a request is already in flight.
          if (!inFlight) void poll();
        }
      )
      .subscribe();

    return () => {
      active = false;
      if (timeoutId) clearTimeout(timeoutId);
      abort.abort();
      document.removeEventListener("visibilitychange", onVisibility);
      supabase.removeChannel(channel);
    };
  }, [activeScanId, pollStatus, keywordId]);

  useEffect(() => {
    async function loadSpotChecks() {
      const res = await fetch(`/api/single-point-rank/${businessId}`);
      if (!res.ok) return;
      const json = await res.json();
      const rows = json.checks ?? [];
      const details: Record<string, SpotCheckDetail> = {};
      setSpotChecks(
        rows.map(
          (c: {
            id: string;
            lat: number;
            lng: number;
            rank: number | null;
            keyword: string;
            label: string | null;
            checked_at: string;
            match_reason: string | null;
            raw_results?: StoredCompetitor[] | null;
          }) => {
            details[c.id] = {
              id: c.id,
              keyword: c.keyword,
              rank: c.rank,
              match_reason: c.match_reason,
              checked_at: c.checked_at,
              lat: c.lat,
              lng: c.lng,
              raw_results: (c.raw_results ?? []) as StoredCompetitor[],
            };
            return {
              id: c.id,
              lat: c.lat,
              lng: c.lng,
              rank: c.rank,
              keyword: c.keyword,
              label: c.label,
              checkedAt: c.checked_at,
            };
          }
        )
      );
      setSpotCheckDetails(details);
    }
    void loadSpotChecks();
  }, [businessId]);

  const batch = data?.batch;
  const business = data?.business;
  const batchStatus = batch?.status ? String(batch.status) : "";
  const cellsInFlight = areCellsInFlight(batchStatus);
  const loadedCells = (data?.results ?? []).length;
  const totalGridCells = data?.points?.length ?? 0;
  const confidence = (batch?.confidence_summary ?? {}) as Record<string, unknown>;
  const failedPointIds = useMemo(() => {
    const ids = confidence.failed_point_ids;
    return new Set(Array.isArray(ids) ? (ids as string[]) : []);
  }, [confidence.failed_point_ids]);
  const failedCellsCount = Math.max(
    failedPointIds.size,
    Number(batch?.cells_failed ?? confidence.failed_cells ?? 0)
  );
  const batchCellsCompleted = Number(batch?.cells_completed ?? confidence.completed_cells ?? 0);
  const trailingSettling = hasTrailingCellsSettling({
    status: batchStatus,
    cells_completed: batch?.cells_completed as number | null | undefined,
    cells_total: batch?.cells_total as number | null | undefined,
    cells_failed: batch?.cells_failed as number | null | undefined,
    confidence_summary: (batch?.confidence_summary ?? null) as Record<string, unknown> | null,
  });
  // Missing results stay pending only while cells are still expected to land.
  // Once cells_completed catches total (final pass), stop treating gaps as "loading"
  // so permanent failures don't leave forever-gray bubbles.
  const cellsStillLoading =
    totalGridCells > 0 &&
    loadedCells < totalGridCells &&
    batchStatus !== "failed" &&
    (cellsInFlight || trailingSettling);
  const cellsPending =
    hasCellsPending({
      status: batchStatus,
      cells_completed: batch?.cells_completed as number | null | undefined,
      cells_total: batch?.cells_total as number | null | undefined,
      confidence_summary: (batch?.confidence_summary ?? null) as Record<string, unknown> | null,
    }) && !cellsInFlight;
  const enrichmentRunning = isEnrichmentRunning({
    status: batchStatus,
    enrichment_status: batch?.enrichment_status as string | null | undefined,
  });
  const scanActive =
    cellsInFlight ||
    cellsStillLoading ||
    trailingSettling ||
    (cellsPending && batchStatus !== "failed");

  // Hold the rank map until every cell has finished (incl. retries). No partial maps.
  // Poller uses this same helper — do not invent a second "done" definition.
  const mapReady = isScanMapReady(
    {
      status: batchStatus,
      cells_completed: batch?.cells_completed as number | null | undefined,
      cells_total: batch?.cells_total as number | null | undefined,
      cells_failed: batch?.cells_failed as number | null | undefined,
      finished_at: (batch?.finished_at as string | null | undefined) ?? null,
      rank_ready_at: (batch?.rank_ready_at as string | null | undefined) ?? null,
      confidence_summary: (batch?.confidence_summary ?? null) as Record<string, unknown> | null,
    },
    loadedCells,
    totalGridCells
  );
  const waitingForMap =
    !!batch && batchStatus !== "failed" && !mapReady && totalGridCells > 0;

  const progressMessage = scanProgressMessage({
    status: batchStatus,
    enrichment_status: batch?.enrichment_status as string | null | undefined,
    // Use server success counters only — saved result rows can exist for cells
    // that still need retry, which made the wait UI look finished early.
    cells_completed: batchCellsCompleted,
    cells_total: Math.max(totalGridCells, Number(batch?.cells_total ?? 0)),
    cells_failed: batch?.cells_failed as number | null | undefined,
    confidence_summary: (batch?.confidence_summary ?? null) as Record<string, unknown> | null,
  });

  const youEntity = useMemo(
    () => (business ? buildYouEntity(business) : null),
    [business]
  );

  const locationTokens = useMemo(
    () =>
      [data?.primaryKeywordCity, data?.primaryKeywordState].filter(
        (t): t is string => !!t?.trim()
      ),
    [data?.primaryKeywordCity, data?.primaryKeywordState]
  );

  /** Top ~20 pack competitors from live results — grows as cells finish. */
  const competitorPool = useMemo(
    () =>
      buildGridTopCompetitors(data?.results ?? [], {
        excludeCid: business?.cid,
        excludePlaceId: business?.place_id,
        excludeName: business?.name,
        targetCategory: business?.primary_category,
        keyword: data?.primaryKeyword as string | null | undefined,
        locationTokens,
        limit: COMPETITOR_POOL_LIMIT,
      }),
    [
      data?.results,
      business?.cid,
      business?.place_id,
      business?.name,
      business?.primary_category,
      data?.primaryKeyword,
      locationTokens,
    ]
  );

  const poolEntities = useMemo(
    () => entitiesFromTopCompetitors(competitorPool, COMPETITOR_POOL_LIMIT),
    [competitorPool]
  );

  const autoChipKeys = useMemo(
    () => poolEntities.slice(0, AUTO_COMPETITOR_CHIPS).map((e) => e.key),
    [poolEntities]
  );

  // Drop pinned keys that graduated into auto chips or left the pool.
  useEffect(() => {
    const auto = new Set(autoChipKeys);
    const poolKeys = new Set(poolEntities.map((e) => e.key));
    setExtraEntityKeys((prev) => {
      const next = prev.filter((k) => poolKeys.has(k) && !auto.has(k));
      return next.length === prev.length && next.every((k, i) => k === prev[i]) ? prev : next;
    });
  }, [autoChipKeys, poolEntities]);

  // Reset user pins when keyword context changes (new scan already clears above).
  useEffect(() => {
    setExtraEntityKeys([]);
    setEntityKey("you");
  }, [keywordId]);

  const entities: EntityOption[] = useMemo(() => {
    if (!youEntity) return [];
    const byKey = new Map(poolEntities.map((e) => [e.key, e]));
    const chips: EntityOption[] = [
      { key: "you", label: youEntity.label, isTarget: true },
    ];
    for (const key of autoChipKeys) {
      const e = byKey.get(key);
      if (!e) continue;
      chips.push({ key: e.key, label: e.label, isTarget: false });
    }
    for (const key of extraEntityKeys) {
      if (autoChipKeys.includes(key)) continue;
      const e = byKey.get(key);
      if (!e) continue;
      chips.push({ key: e.key, label: e.label, isTarget: false });
    }
    return chips;
  }, [youEntity, poolEntities, autoChipKeys, extraEntityKeys]);

  const addPool: CompetitorAddOption[] = useMemo(() => {
    const shown = new Set(entities.map((e) => e.key));
    return poolEntities
      .filter((e) => !shown.has(e.key))
      .map((e) => {
        const raw = competitorPool.find(
          (c) => entityKeyFromParts(c) === e.key
        );
        return {
          key: e.key,
          label: e.label,
          placeId: e.place_id,
          subtitle: raw?.category ?? null,
        };
      });
  }, [entities, poolEntities, competitorPool]);

  const removableKeys = useMemo(() => new Set(extraEntityKeys), [extraEntityKeys]);

  const pinCompetitor = useCallback((key: string) => {
    if (key === "you") {
      setEntityKey("you");
      return;
    }
    setEntityKey(key);
    setExtraEntityKeys((prev) => {
      if (prev.includes(key) || autoChipKeys.includes(key)) return prev;
      return [...prev, key];
    });
  }, [autoChipKeys]);

  const removeCompetitor = useCallback(
    (key: string) => {
      setExtraEntityKeys((prev) => prev.filter((k) => k !== key));
      setEntityKey((current) => (current === key ? "you" : current));
    },
    []
  );

  const activeEntity = useMemo(() => {
    if (entityKey === "you" || !youEntity) return youEntity;
    const fromPool = poolEntities.find((e) => e.key === entityKey);
    if (fromPool) return fromPool;
    const found = entities.find((e) => e.key === entityKey);
    if (found && !found.isTarget) return entityFromKey(found.key, found.label);
    return youEntity;
  }, [entityKey, entities, poolEntities, youEntity]);

  const gridCells = useMemo(() => {
    if (!data?.points || !activeEntity) return [];
    return buildEntityGridCells(
      data.points as Array<{ id: string; grid_label: string; lat: number; lng: number }>,
      data.results as Array<{
        scan_point_id: string;
        target_rank?: number | null;
        target_found?: boolean;
        confidence?: string | null;
        top_competitors_json?: unknown;
      }>,
      activeEntity,
      { scanActive: scanActive || cellsStillLoading, failedPointIds }
    );
  }, [data?.points, data?.results, activeEntity, scanActive, cellsStillLoading, failedPointIds]);

  const entityMetrics = useMemo(() => metricsFromCells(gridCells), [gridCells]);
  const entitySolv = useMemo(() => solvFromCells(gridCells), [gridCells]);
  const batchMetrics = (batch?.aggregate_metrics ?? null) as ScanAggregateMetrics | null;
  const displayMetrics =
    entityKey === "you" && batchMetrics?.totalCells && !scanActive && !cellsStillLoading
      ? batchMetrics
      : entityMetrics;
  const solv =
    entityKey === "you" && batchMetrics?.totalCells && !scanActive && !cellsStillLoading
      ? computeSolv(batchMetrics.top3Cells ?? 0, batchMetrics.totalCells ?? 0)
      : entitySolv;

  const trend = computeScanTrend(
    entityMetrics,
    (data?.priorMetrics as Parameters<typeof computeScanTrend>[1]) ?? null
  );

  /** Table shows the leading pack; picker uses the fuller pool. */
  const topCompetitors = competitorPool.slice(0, AUTO_COMPETITOR_CHIPS);

  const cells: GridCell[] = gridCells.map((c) => ({
    label: c.label,
    lat: c.lat,
    lng: c.lng,
    rank: c.rank,
    pending: c.pending,
    failed: c.failed,
    notInResults: c.notInResults,
    pointId: c.pointId,
  }));

  const notInPackCells = cells.filter((c) => c.notInResults).length;

  const mid = Math.floor((cells.length - 1) / 2);
  const gridCenterLat = cells[mid]?.lat ?? cells[0]?.lat ?? 0;
  const gridCenterLng = cells[mid]?.lng ?? cells[0]?.lng ?? 0;
  const batchCenterLat = (batch?.center_lat as number | null) ?? null;
  const batchCenterLng = (batch?.center_lng as number | null) ?? null;
  const batchCenterLabel = (batch?.center_label as string | null) ?? null;
  const officeLat =
    batchCenterLat ?? business?.scan_center_lat ?? business?.lat ?? gridCenterLat;
  const officeLng =
    batchCenterLng ?? business?.scan_center_lng ?? business?.lng ?? gridCenterLng;
  const checkUrl = (data?.results?.[0]?.check_url as string) ?? null;
  const rawProgressCompleted = Math.max(
    batchCellsCompleted,
    Number(confidence.completed_cells ?? 0)
  );
  const progressTotal = Math.max(
    Number(confidence.total_cells ?? 0),
    Number(batch?.cells_total ?? 0),
    totalGridCells
  );
  const progressCompleted = Math.min(
    Math.max(peakProgress, rawProgressCompleted),
    progressTotal > 0 ? progressTotal : Number.POSITIVE_INFINITY
  );
  const waitPhase = scanWaitPhase({
    status: batchStatus,
    cells_completed: progressCompleted,
    cells_total: progressTotal,
    confidence_summary: confidence,
  });
  const waitTitle =
    waitPhase === "creating_map"
      ? "Creating your map"
      : waitPhase === "retrying"
        ? "Finishing a few locations"
        : "Scan running";
  const waitBody =
    waitPhase === "creating_map"
      ? "Locations are in — assembling the rank map now. This usually only takes a few more seconds."
      : waitPhase === "retrying"
        ? "Most points are done. We’re retrying the rest so the map is complete before it appears."
        : "We’re checking every grid point now. The rank map will appear when the full scan finishes — including any automatic retries.";
  const waitShowCounter = waitPhase !== "creating_map";
  const waitBarPct =
    waitPhase === "creating_map"
      ? 100
      : progressTotal > 0
        ? Math.round((progressCompleted / progressTotal) * 100)
        : 8;
  const allRanks = cells.map((c) => (c.notInResults ? null : c.rank));
  const weightedSolv = computeWeightedSolv(allRanks);
  const gridSize = Number(batch?.grid_size ?? 5);
  const radiusMeters = Number(batch?.radius_meters ?? 2000);
  const scanMeta = gridScanMeta(gridSize, radiusMeters);
  const scanProfile = batch
    ? profileFromBatch(batch as { device?: string; os?: string; browser?: string })
    : null;

  const effectivePreviewCenter = previewCenter ?? [officeLat, officeLng] as [number, number];
  const previewCells = useMoveGridPreview(
    effectivePreviewCenter[0],
    effectivePreviewCenter[1],
    gridSize,
    radiusMeters
  );

  const mapMode: MapInteractionMode = moveGridActive
    ? "move-grid"
    : singlePointActive
      ? "single-point"
      : "default";

  const keywordOptions = data
    ? [{ id: data.primaryKeywordId as string, keyword: String(data.primaryKeyword ?? "").trim() }].filter(
        (k) => k.id && k.keyword
      )
    : [];

  const viewingEntity = entities.find((e) => e.key === entityKey);

  const rankByDistance = useMemo(
    () =>
      computeGridRankByDistance(
        gridCells.map((c) => ({
          row: c.row,
          col: c.col,
          rank: c.rank,
          notInResults: c.notInResults,
        })),
        gridSize,
        radiusMeters
      ),
    [gridCells, gridSize, radiusMeters]
  );

  const competitorTimelineOptions = useMemo(
    () =>
      competitorPool.slice(0, AUTO_COMPETITOR_CHIPS).map((c) => ({
        key: entityKeyFromParts(c),
        label: c.name ?? "Competitor",
      })),
    [competitorPool]
  );

  useEffect(() => {
    if (!timelineCompetitorKey && competitorTimelineOptions[0]) {
      setTimelineCompetitorKey(competitorTimelineOptions[0].key);
    }
  }, [competitorTimelineOptions, timelineCompetitorKey]);

  useEffect(() => {
    if (timelineMode === "competitor" && timelineCompetitorKey) {
      pinCompetitor(timelineCompetitorKey);
    } else if (timelineMode === "target") {
      setEntityKey("you");
    }
  }, [timelineMode, timelineCompetitorKey, pinCompetitor]);

  function handleMoveGridToggle() {
    setMoveGridActive((v) => {
      if (!v) {
        setPreviewCenter([officeLat, officeLng]);
        setSinglePointActive(false);
      }
      return !v;
    });
  }

  function handleSinglePointToggle() {
    setSinglePointActive((v) => {
      if (!v) setMoveGridActive(false);
      return !v;
    });
  }

  function handleMapClick(lat: number, lng: number) {
    if (moveGridActive) {
      setPreviewCenter([lat, lng]);
      return;
    }
    if (singlePointActive) {
      setPendingClick({ lat, lng });
    }
  }

  async function runMoveGridScan() {
    if (!keywordId || !previewCenter) return;
    setMoveScanRunning(true);
    setActionError(null);
    try {
      const res = await fetch("/api/scans/run-for-keyword", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          keywordId,
          gridSize,
          radiusMeters,
          device: String(batch?.device ?? "mobile"),
          os: String(batch?.os ?? "android"),
          browser: String((batch as { browser?: string })?.browser ?? "chrome"),
          locationId,
          centerLat: previewCenter[0],
          centerLng: previewCenter[1],
          centerLabel: batchCenterLabel ?? `Moved center`,
          movedFromScanId: activeScanId,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Scan failed");
      setMoveGridActive(false);
      const { goToDashboardAfterScanStart } = await import("@/lib/scans/after-scan-start");
      goToDashboardAfterScanStart(businessId);
      return;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Move-grid scan failed");
    } finally {
      setMoveScanRunning(false);
    }
  }

  async function runSinglePointCheck(kwId: string, keyword: string, label: string) {
    if (!pendingClick) return;
    setSinglePointRunning(true);
    setActionError(null);
    try {
      const res = await fetch("/api/single-point-rank/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          keyword,
          keywordId: kwId,
          lat: pendingClick.lat,
          lng: pendingClick.lng,
          label: label || undefined,
          locationId,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Check failed");
      const c = json.check;
      const detail: SpotCheckDetail = {
        id: c.id,
        keyword: c.keyword,
        rank: c.rank,
        match_reason: c.match_reason ?? json.match_reason ?? null,
        checked_at: c.checked_at,
        lat: c.lat,
        lng: c.lng,
        raw_results: (json.raw_results ?? c.raw_results ?? []) as StoredCompetitor[],
      };
      setSpotCheckDetails((prev) => ({ ...prev, [c.id]: detail }));
      setSpotChecks((prev) => [
        {
          id: c.id,
          lat: c.lat,
          lng: c.lng,
          rank: c.rank,
          keyword: c.keyword,
          label: c.label,
          checkedAt: c.checked_at,
        },
        ...prev,
      ]);
      setActiveSpotCheckId(c.id);
      setPendingClick(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Spot check failed");
    } finally {
      setSinglePointRunning(false);
    }
  }

  function handleCellClick(cell: GridCell) {
    if (cell.pointId) setInspectorCellId(cell.pointId);
  }

  const inspectorCellIds = useMemo(
    () => cells.filter((c) => c.pointId).map((c) => c.pointId as string),
    [cells]
  );

  // When scan/keyword changes, reopen on the center pin (not a blank map).
  useEffect(() => {
    setInspectorCellId(null);
  }, [activeScanId, keywordId]);

  // Auto-select the geometric center cell once points are available.
  useEffect(() => {
    if (!gridCells.length || gridSize < 1) return;
    if (inspectorCellId && gridCells.some((c) => c.pointId === inspectorCellId)) return;
    const mid = Math.floor(gridSize / 2);
    const center =
      gridCells.find((c) => c.row === mid && c.col === mid && c.pointId) ??
      gridCells.find((c) => c.pointId);
    if (center?.pointId) setInspectorCellId(center.pointId);
  }, [gridCells, gridSize, inspectorCellId]);

  const inspectorIndex = inspectorCellId ? inspectorCellIds.indexOf(inspectorCellId) : -1;
  const inspectorPointLabel = useMemo(() => {
    const cell = cells.find((c) => c.pointId === inspectorCellId);
    return cell?.label ?? null;
  }, [cells, inspectorCellId]);

  const headerBtn = gridRankHeaderBtn;

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", gridRankPageBg)}>
      {actionError && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-[13px] text-red-700">
          {actionError}
          <button
            type="button"
            className="ml-3 text-[12px] font-medium underline"
            onClick={() => setActionError(null)}
          >
            Dismiss
          </button>
        </div>
      )}
      <div className="border-b border-zinc-200/80 bg-white/90 px-3 py-2.5 backdrop-blur sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex min-w-0 flex-wrap items-center gap-2.5">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h1 className="text-[17px] font-bold tracking-tight text-zinc-900 sm:text-[19px]">
                  Rank Grid
                </h1>
                {batch?.status ? <StatusBadge status={String(batch.status)} /> : null}
                {enrichmentRunning ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900">
                    <Loader2 className="h-3 w-3 animate-spin" /> Enriching…
                  </span>
                ) : null}
                {scanActive ? <Loader2 className="h-4 w-4 animate-spin text-emerald-600" /> : null}
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:border-l sm:border-zinc-200 sm:pl-3">
                <button type="button" onClick={() => setCompareOpen(true)} className={headerBtn}>
                  <GitCompare className="h-3.5 w-3.5" /> Compare
                </button>
                <Link href={`/businesses/${businessId}/scans`} className={headerBtn}>
                  History
                </Link>
                <OpenReportWithStagingLink
                  businessId={businessId}
                  source="maps_scan"
                  title={`Maps scan ${String((confidence as { keyword_label?: string }).keyword_label ?? "").trim() || activeScanId}`}
                  href={`/businesses/${businessId}/grid/${activeScanId}`}
                  meta={{ scanId: activeScanId }}
                  reportType="single_scan"
                  label="Add to report"
                  className={headerBtn}
                />
                <Link
                  href={`/businesses/${businessId}/campaigns`}
                  className={headerBtn}
                  title="Create or update a Maps campaign"
                >
                  Campaign
                </Link>
                <Link
                  href={`/businesses/${businessId}/competitors`}
                  className={headerBtn}
                >
                  Competitors
                </Link>
                {isDev && (
                  <Link
                    href={`/businesses/${businessId}/grid/${activeScanId}/debug`}
                    className={headerBtn}
                  >
                    Debug Requests
                  </Link>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleMoveGridToggle}
                className={`${headerBtn} ${
                  moveGridActive ? "border-blue-400 bg-blue-50 text-blue-800" : ""
                }`}
              >
                <MapPinned className="h-4 w-4" /> Move Grid
              </button>
              <button
                type="button"
                onClick={handleSinglePointToggle}
                className={`${headerBtn} ${
                  singlePointActive ? "border-amber-400 bg-amber-50 text-amber-800" : ""
                }`}
              >
                <Crosshair className="h-4 w-4" /> Single-Point
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-x-hidden overflow-y-auto px-3 py-3 sm:px-5">
        {!data ? (
          <div className="flex items-center gap-2 text-zinc-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading scan…
          </div>
        ) : (
          <>
            {scanActive || waitingForMap ? (
              <div className="mb-3 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-[12px] text-zinc-600">
                <p className="font-semibold text-zinc-900">Scan queued / running</p>
                <p className="mt-0.5">
                  This continues in the background. You can cancel it, return to the client, or start another scan.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <CancelScanButton scanId={activeScanId} />
                  <Link
                    href={`/businesses/${businessId}/overview`}
                    className="rounded-lg border border-zinc-200 px-2.5 py-1.5 font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    Return to Dashboard
                  </Link>
                  <Link
                    href={`/businesses/${businessId}/scans`}
                    className="rounded-lg border border-zinc-200 px-2.5 py-1.5 font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    Start another scan
                  </Link>
                </div>
              </div>
            ) : null}

            {moveGridActive && (
              <MoveGridPanel
                centerLat={effectivePreviewCenter[0]}
                centerLng={effectivePreviewCenter[1]}
                gridSize={gridSize}
                radiusMeters={radiusMeters}
                onRunScan={() => void runMoveGridScan()}
                onCancel={() => setMoveGridActive(false)}
                running={moveScanRunning}
              />
            )}

            {waitingForMap ? (
              <div className="mb-3 flex min-h-[min(52vh,420px)] flex-col items-center justify-center rounded-xl border border-zinc-200 bg-gradient-to-b from-emerald-50/80 to-white px-4 py-10 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:min-h-[min(62vh,560px)] sm:px-6 sm:py-12">
                <Loader2 className="h-9 w-9 animate-spin text-emerald-600" />
                <h2 className="mt-4 text-[18px] font-semibold text-zinc-900">{waitTitle}</h2>
                <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-zinc-600">
                  {waitBody}
                </p>
                <p className="mt-4 text-[14px] font-medium text-zinc-800">
                  {waitShowCounter ? (
                    progressTotal > 0 ? (
                      <>
                        {progressCompleted} / {progressTotal} locations
                      </>
                    ) : (
                      "Starting…"
                    )
                  ) : (
                    "Assembling map…"
                  )}
                </p>
                <div className="mt-3 h-2 w-full max-w-sm overflow-hidden rounded-full bg-emerald-100">
                  <div
                    className="h-full rounded-full bg-emerald-600 transition-all duration-500"
                    style={{ width: `${waitBarPct}%` }}
                  />
                </div>
                <p className="mt-3 text-[12px] text-zinc-500">
                  {progressMessage ||
                    (waitPhase === "creating_map"
                      ? "Hang tight — almost ready."
                      : "This usually takes under a minute.")}
                </p>
              </div>
            ) : (
              <>
                <div
                  className={`mb-3 space-y-2 transition-opacity duration-300 ${
                    timelineFetching ? "opacity-70" : "opacity-100"
                  }`}
                >
                  <KpiRow cols={4}>
                    <GridMetricCard
                      variant="primary"
                      label="SoLV"
                      value={`${solv}%`}
                      sub="Top-3 map pack"
                      icon={Target}
                      iconWrapClassName="bg-emerald-50"
                      iconClassName="text-emerald-600"
                    />
                    <GridMetricCard
                      label="Avg Rank"
                      value={displayMetrics.averageRank ?? "—"}
                      sub={
                        trend.avgRankDelta != null
                          ? `${trend.avgRankDelta > 0 ? "↑" : "↓"} ${Math.abs(trend.avgRankDelta)} vs last`
                          : undefined
                      }
                      trendPositive={trend.avgRankDelta != null ? trend.avgRankDelta > 0 : undefined}
                      icon={TrendingDown}
                      iconWrapClassName="bg-sky-50"
                      iconClassName="text-sky-600"
                    />
                    <GridMetricCard
                      label="Visibility"
                      value={`${displayMetrics.visibilityScore ?? 0}%`}
                      sub={
                        trend.visibilityDelta != null
                          ? `${trend.visibilityDelta >= 0 ? "+" : ""}${trend.visibilityDelta}% vs last`
                          : "Top-10 share"
                      }
                      trendPositive={
                        trend.visibilityDelta != null ? trend.visibilityDelta >= 0 : undefined
                      }
                      icon={Eye}
                      iconWrapClassName="bg-emerald-50"
                      iconClassName="text-emerald-600"
                    />
                    <GridMetricCard
                      label="Weighted SoLV"
                      value={`${weightedSolv}%`}
                      sub="Ranks 4–20"
                      icon={BarChart3}
                      iconWrapClassName="bg-emerald-50"
                      iconClassName="text-emerald-600"
                    />
                  </KpiRow>
                  <GridTopCellsGroup
                    top3={displayMetrics.top3Cells ?? 0}
                    top10={displayMetrics.top10Cells ?? 0}
                    top20={displayMetrics.top20Cells ?? 0}
                    total={displayMetrics.totalCells || totalGridCells}
                    top10Delta={trend.top10Delta}
                  />
                </div>

                {entities.length > 0 && (
                  <CompetitorGridToggle
                    entities={entities}
                    selectedKey={entityKey}
                    onSelect={pinCompetitor}
                    addPool={addPool}
                    onAdd={pinCompetitor}
                    removableKeys={removableKeys}
                    onRemove={removeCompetitor}
                    viewingLabel={viewingEntity?.label}
                    className="mb-2"
                  />
                )}

                {enrichmentRunning && progressMessage && (
                  <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50/80 px-3.5 py-2 dark:border-amber-900 dark:bg-amber-950/40">
                    <p className="text-xs text-amber-900 dark:text-amber-100">{progressMessage}</p>
                  </div>
                )}

                {cells.length > 0 && mapReady && (
                  <div className="mb-3">
                    <ScanTimelineSlider
                      businessId={businessId}
                      currentScanId={activeScanId}
                      keywordId={keywordId}
                      locationId={locationId}
                      gridSize={gridSize}
                      radiusMeters={radiusMeters}
                      mode={timelineMode}
                      competitorKey={timelineCompetitorKey}
                      competitorOptions={competitorTimelineOptions}
                      keywordOptions={keywordOptions}
                      onModeChange={setTimelineMode}
                      onCompetitorChange={setTimelineCompetitorKey}
                      onKeywordChange={(kwId) => switchScan(activeScanId, kwId)}
                      onScanSelect={(id) => switchScan(id)}
                      onPrefetchScan={prefetchScanData}
                      className="mb-2"
                    />
                    <div
                      className={cn(
                        gridRankWorkspaceClass,
                        // Tall enough for your business + 5 competitor rows; map keeps a little top/bottom room.
                        "flex h-[min(74vh,700px)] min-h-[460px] flex-col overflow-hidden transition-opacity duration-300 lg:h-[min(78vh,760px)] lg:flex-row",
                        timelineFetching ? "opacity-75" : "opacity-100"
                      )}
                    >
                      <div className="flex max-h-[42vh] min-h-0 w-full shrink-0 flex-col overflow-hidden border-b border-zinc-200/80 lg:max-h-none lg:h-full lg:w-[36%] lg:max-w-[440px] lg:border-b-0 lg:border-r">
                        <CellInspectorDrawer
                          variant="panel"
                          alwaysVisible
                          scanId={activeScanId}
                          cellId={inspectorCellId}
                          keywordId={keywordId}
                          businessId={businessId}
                          selectedEntityKey={entityKey}
                          pointLabel={inspectorPointLabel}
                          canNavigatePrev={inspectorIndex > 0}
                          canNavigateNext={
                            inspectorIndex >= 0 && inspectorIndex < inspectorCellIds.length - 1
                          }
                          onNavigatePrev={() => {
                            if (inspectorIndex > 0) {
                              setInspectorCellId(inspectorCellIds[inspectorIndex - 1] ?? null);
                            }
                          }}
                          onNavigateNext={() => {
                            if (inspectorIndex < inspectorCellIds.length - 1) {
                              setInspectorCellId(inspectorCellIds[inspectorIndex + 1] ?? null);
                            }
                          }}
                          onClose={() => {
                            /* Panel stays open — re-select center instead of blanking. */
                            const mid = Math.floor(gridSize / 2);
                            const center = gridCells.find(
                              (c) => c.row === mid && c.col === mid && c.pointId
                            );
                            setInspectorCellId(center?.pointId ?? inspectorCellIds[0] ?? null);
                          }}
                          onCompareCell={() => {
                            setCompareOpen(true);
                          }}
                          className="min-h-0 flex-1"
                        />
                      </div>
                      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                        <div className="relative min-h-0 flex-1">
                          {batch?.finished_at || batch?.created_at ? (
                            <div className="absolute left-3 top-3 z-[500] rounded-full border border-zinc-200/80 bg-white/95 px-3 py-1.5 text-[11px] font-semibold text-zinc-600 shadow-[0_4px_16px_rgba(15,23,42,0.08)] backdrop-blur">
                              {new Date(
                                String(batch.finished_at ?? batch.created_at)
                              ).toLocaleString(undefined, {
                                month: "long",
                                day: "numeric",
                                year: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </div>
                          ) : null}
                          <div className="absolute right-3 top-3 z-[500] flex rounded-full border border-zinc-200/80 bg-white/95 p-0.5 text-[11px] shadow-[0_4px_16px_rgba(15,23,42,0.08)] backdrop-blur">
                            <button
                              type="button"
                              onClick={() => setShowRadiusRings(false)}
                              className={`rounded-full px-3 py-1 font-semibold ${
                                !showRadiusRings
                                  ? "bg-[#137752] text-white"
                                  : "text-zinc-600 hover:bg-zinc-50"
                              }`}
                            >
                              Grid
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowRadiusRings(true)}
                              className={`rounded-full px-3 py-1 font-semibold ${
                                showRadiusRings
                                  ? "bg-[#137752] text-white"
                                  : "text-zinc-600 hover:bg-zinc-50"
                              }`}
                            >
                              Rings
                            </button>
                          </div>
                          <ScanMap
                            key={`${colorMode}-${entityKey}-${mapMode}`}
                            officeCenter={[officeLat, officeLng]}
                            cells={cells}
                            businessName={entityKey === "you" ? business?.name : viewingEntity?.label}
                            colorMode={colorMode}
                            height="100%"
                            onCellClick={mapMode === "default" ? handleCellClick : undefined}
                            interactionMode={mapMode}
                            previewCenter={moveGridActive ? effectivePreviewCenter : undefined}
                            previewCells={moveGridActive ? previewCells : undefined}
                            onPreviewCenterChange={
                              moveGridActive
                                ? (lat, lng) => setPreviewCenter([lat, lng])
                                : undefined
                            }
                            onMapClick={handleMapClick}
                            cellsFaded={moveGridActive}
                            spotChecks={spotChecks}
                            onSpotCheckClick={setActiveSpotCheckId}
                            showRadiusRings={showRadiusRings}
                            radiusCenter={[officeLat, officeLng]}
                            radiusRingMiles={scanMeta.ringDistancesMiles}
                            gridSize={gridSize}
                            radiusMeters={radiusMeters}
                          />
                        </div>
                        <div className="shrink-0 border-t border-zinc-100 bg-white px-3.5 py-2">
                          <GridRankLegend
                            mode={colorMode}
                            onModeChange={handleColorModeChange}
                            showModeToggle={false}
                          />
                          <div className="mt-1 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                handleColorModeChange(colorMode === "falcon" ? "strict" : "falcon")
                              }
                              className="text-[10px] text-zinc-400 hover:text-zinc-600"
                            >
                              Color scale: {colorMode === "falcon" ? "Gradient" : "Strict"}
                            </button>
                          </div>
                        </div>
                        {showRadiusRings && (
                          <div className="shrink-0 border-t border-zinc-100 px-4 py-2">
                            <RankByDistanceCard buckets={rankByDistance} />
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="mt-3 text-center text-[12px] text-zinc-500">
                      ~{scanMeta.spacingMiles} miles between map pins
                      {notInPackCells > 0 ? ` · ${notInPackCells} cells outside local pack` : ""}
                      {" · Results open on the center pin · click any bubble to switch"}
                    </p>
                  </div>
                )}
              </>
            )}

            {loadedCells === 0 && !scanActive && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                <p className="font-medium">No scan yet for this keyword</p>
                <p className="mt-1">
                  Start a new scan from{" "}
                  <Link
                    href={`/businesses/${businessId}/scans`}
                    className="font-semibold underline hover:text-amber-950"
                  >
                    Rank Grid setup
                  </Link>{" "}
                  to load rank data.
                </p>
              </div>
            )}

            {!scanActive &&
              loadedCells === 0 &&
              failedCellsCount === 0 &&
              displayMetrics.notFoundCells === displayMetrics.totalCells &&
              displayMetrics.totalCells > 0 && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
                <p className="font-medium">No ranking data returned</p>
                <p className="mt-1">
                  Rank data came back empty for every search point. The scan may still recover in
                  the background — check the dashboard, or retry after confirming the location is
                  complete.
                </p>
              </div>
            )}

            {entityKey === "you" && topCompetitors.length > 0 && (
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <GridScanCompetitorsTable
                  competitors={topCompetitors}
                  keyword={data?.primaryKeyword}
                  onSelectCompetitor={(key) => pinCompetitor(key)}
                />
                <GridScanTrendChart
                  businessId={businessId}
                  currentScanId={activeScanId}
                  keywordId={keywordId}
                  locationId={locationId}
                  gridSize={gridSize}
                  radiusMeters={radiusMeters}
                />
              </div>
            )}

            {activeScanId && mapReady ? (
              <section className="mt-3 rounded-lg border border-zinc-200 bg-white p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                <ScanExportMenu businessId={businessId} scanBatchId={activeScanId} />
              </section>
            ) : null}
          </>
        )}
        </div>

      {compareOpen && (
        <GridCompareView
          businessId={businessId}
          currentScanId={activeScanId}
          officeCenter={[officeLat, officeLng]}
          colorMode={colorMode}
          keywordId={keywordId}
          entities={entities}
          businessName={business?.name ?? "Your business"}
          keyword={data?.primaryKeyword as string | undefined}
          device={String(batch?.device ?? "mobile")}
          os={String(batch?.os ?? "android")}
          browser={String((batch as { browser?: string })?.browser ?? "chrome")}
          initialMode={compareInitialMode}
          initialCompetitorKey={compareInitialCompetitorKey}
          initialScanAId={compareInitialScanAId}
          onClose={() => {
            setCompareOpen(false);
            setCompareInitialCompetitorKey(null);
          }}
        />
      )}

      {pendingClick && (
        <SinglePointConfirmModal
          lat={pendingClick.lat}
          lng={pendingClick.lng}
          keywords={
            keywordOptions.length
              ? keywordOptions
              : [{ id: keywordId ?? "", keyword: String(data?.primaryKeyword ?? "") }]
          }
          defaultKeywordId={keywordId}
          onConfirm={(kwId, kw, label) => void runSinglePointCheck(kwId, kw, label)}
          onCancel={() => setPendingClick(null)}
        />
      )}

      {singlePointRunning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
        </div>
      )}

      <SpotCheckInspector
        checkId={activeSpotCheckId}
        businessId={businessId}
        cachedDetail={activeSpotCheckId ? spotCheckDetails[activeSpotCheckId] : null}
        onClose={() => setActiveSpotCheckId(null)}
      />

    </div>
  );
}
