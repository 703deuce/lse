"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Play, Plus, Zap } from "lucide-react";
import { StatusBadge } from "@/components/ui/metric-card";
import { EmptyState } from "@/components/ui/design-system";
import {
  DEFAULT_GRID_SIZE,
  DEFAULT_RADIUS_METERS,
  GRID_SIZE_OPTIONS,
  RADIUS_MILE_PRESETS,
  milesToMeters,
  metersToMiles,
} from "@/lib/maps/grid-metrics";
import { DEFAULT_SCAN_PROFILE } from "@/lib/maps/scan-profiles";
import { computeSolv } from "@/lib/maps/grid-metrics";

export type ScanListItem = {
  id: string;
  status: string;
  grid_size: number;
  radius_meters: number;
  created_at: string;
  finished_at: string | null;
  center_label: string | null;
  keyword: string | null;
  keyword_id: string | null;
  aggregate_metrics: {
    averageRank?: number | null;
    top3Cells?: number;
    totalCells?: number;
    visibilityScore?: number | null;
  } | null;
};

export type KeywordOption = {
  id: string;
  keyword: string;
  is_primary?: boolean;
};

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

export function ScansHub({
  businessId,
  scans,
  keywords,
  defaultCenterLat,
  defaultCenterLng,
}: {
  businessId: string;
  scans: ScanListItem[];
  keywords: KeywordOption[];
  defaultCenterLat: number;
  defaultCenterLng: number;
}) {
  const router = useRouter();
  const [keywordFilter, setKeywordFilter] = useState<string>("all");
  const [selectedKeywordId, setSelectedKeywordId] = useState(
    keywords.find((k) => k.is_primary)?.id ?? keywords[0]?.id ?? ""
  );
  const [gridSize, setGridSize] = useState(DEFAULT_GRID_SIZE);
  const [radiusMeters, setRadiusMeters] = useState(DEFAULT_RADIUS_METERS);
  const [newKeyword, setNewKeyword] = useState("");
  const [showAddKeyword, setShowAddKeyword] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const radiusMiles = Math.round(metersToMiles(radiusMeters) * 10) / 10;
  const closestRadiusMiles = RADIUS_MILE_PRESETS.reduce((best, p) =>
    Math.abs(p.miles - radiusMiles) < Math.abs(best.miles - radiusMiles) ? p : best
  ).miles;

  const filteredScans = useMemo(() => {
    if (keywordFilter === "all") return scans;
    return scans.filter((s) => s.keyword_id === keywordFilter);
  }, [scans, keywordFilter]);

  async function runScan(keywordId: string, burstMode = false) {
    if (!keywordId) return;
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/scans/run-for-keyword", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          keywordId,
          gridSize,
          radiusMeters,
          device: DEFAULT_SCAN_PROFILE.device,
          os: DEFAULT_SCAN_PROFILE.os,
          browser: DEFAULT_SCAN_PROFILE.browser,
          ...(burstMode ? { burstMode: true } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Scan failed to start");
      router.push(`/businesses/${businessId}/grid/${json.scan.id}?keywordId=${keywordId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setRunning(false);
    }
  }

  async function addKeyword(andRun: boolean) {
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
        if (andRun) await runScan(json.keyword.id);
        else router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Add failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">Run a new grid scan</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Pick a keyword, grid size, and radius — then start scanning.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-medium text-zinc-600">
            Keyword
            <select
              value={selectedKeywordId}
              onChange={(e) => setSelectedKeywordId(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
            >
              {keywords.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.keyword}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-zinc-600">
            Grid
            <select
              value={gridSize}
              onChange={(e) => setGridSize(Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
            >
              {GRID_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}×{n} ({n * n} points)
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-zinc-600">
            Radius
            <select
              value={closestRadiusMiles}
              onChange={(e) => setRadiusMeters(milesToMeters(Number(e.target.value)))}
              className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
            >
              {RADIUS_MILE_PRESETS.map((p) => (
                <option key={p.miles} value={p.miles}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-col items-stretch justify-end gap-2">
            <button
              type="button"
              disabled={running || !selectedKeywordId}
              onClick={() => void runScan(selectedKeywordId)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-[#137752] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f6244] disabled:opacity-50"
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Run scan
            </button>
            <button
              type="button"
              disabled={running || !selectedKeywordId}
              onClick={() => void runScan(selectedKeywordId, true)}
              title="Fire all grid cells concurrently (burst test mode)"
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-violet-300 bg-violet-50 px-4 py-2 text-xs font-semibold text-violet-900 hover:bg-violet-100 disabled:opacity-50"
            >
              {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
              Burst test (all {gridSize * gridSize} at once)
            </button>
            <button
              type="button"
              onClick={() => setShowAddKeyword((v) => !v)}
              className="rounded-md border border-zinc-200 px-3 py-2 text-zinc-600 hover:bg-zinc-50"
              title="Add keyword"
            >
              <Plus className="h-4 w-4 mx-auto" />
            </button>
          </div>
        </div>

        {showAddKeyword && (
          <div className="mt-3 flex flex-col gap-2 border-t border-zinc-100 pt-3 sm:flex-row">
            <input
              type="text"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              placeholder='New keyword, e.g. "junk removal woodbridge"'
              className="flex-1 rounded-md border border-zinc-200 px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={running || !newKeyword.trim()}
              onClick={() => void addKeyword(false)}
              className="rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium"
            >
              Add keyword
            </button>
            <button
              type="button"
              disabled={running || !newKeyword.trim()}
              onClick={() => void addKeyword(true)}
              className="rounded-md bg-[#137752] px-3 py-2 text-sm font-semibold text-white"
            >
              Add & run
            </button>
          </div>
        )}

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <p className="mt-2 text-xs text-zinc-400">
          Scan center uses your saved business location ({defaultCenterLat.toFixed(4)},{" "}
          {defaultCenterLng.toFixed(4)}). Change it from the grid map with Move Grid.
        </p>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Scan history</h2>
          <p className="text-sm text-zinc-500">{filteredScans.length} scan(s)</p>
        </div>
        <select
          value={keywordFilter}
          onChange={(e) => setKeywordFilter(e.target.value)}
          className="rounded-md border border-zinc-200 px-3 py-2 text-sm"
        >
          <option value="all">All keywords</option>
          {keywords.map((k) => (
            <option key={k.id} value={k.id}>
              {k.keyword}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
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
              className="block rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm transition hover:border-emerald-200 hover:shadow-md"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-semibold text-zinc-900">
                    {scan.keyword ? `“${scan.keyword}”` : "Unknown keyword"}
                  </p>
                  <p className="mt-1 text-sm text-zinc-600">
                    {scan.grid_size}×{scan.grid_size} grid · {formatRadius(scan.radius_meters)} radius
                    {scan.center_label ? ` · ${scan.center_label}` : ""}
                  </p>
                  <p className="mt-1 text-sm text-zinc-500">
                    {formatScanDate(scan.finished_at ?? scan.created_at)}
                    {metrics.averageRank != null && (
                      <> · Avg rank {metrics.averageRank}</>
                    )}
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
            description={
              keywordFilter === "all"
                ? "Run your first grid scan using the form above."
                : "No scans for this keyword yet. Run one above."
            }
          />
        )}
      </div>
    </div>
  );
}
