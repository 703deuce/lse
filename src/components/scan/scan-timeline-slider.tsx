"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Play, Pause } from "lucide-react";
import { rankLabel } from "@/lib/maps/grid-metrics";
import type { ScanHistoryEntry } from "@/lib/maps/scan-history";

export type TimelineMode = "target" | "competitor" | "keyword";

const WINDOW_SIZE = 7;

interface ScanTimelineSliderProps {
  businessId: string;
  currentScanId: string;
  keywordId?: string | null;
  locationId?: string | null;
  gridSize?: number;
  radiusMeters?: number;
  mode?: TimelineMode;
  competitorKey?: string | null;
  keywordOptions?: Array<{ id: string; keyword: string }>;
  competitorOptions?: Array<{ key: string; label: string }>;
  onModeChange?: (mode: TimelineMode) => void;
  onCompetitorChange?: (key: string) => void;
  onKeywordChange?: (keywordId: string) => void;
  onScanSelect: (scanId: string, entry: ScanHistoryEntry) => void;
  onPrefetchScan?: (scanId: string) => void;
  className?: string;
}

export function ScanTimelineSlider({
  businessId,
  currentScanId,
  keywordId,
  locationId,
  gridSize,
  radiusMeters,
  mode = "target",
  competitorKey,
  keywordOptions = [],
  competitorOptions = [],
  onModeChange,
  onCompetitorChange,
  onKeywordChange,
  onScanSelect,
  onPrefetchScan,
  className = "",
}: ScanTimelineSliderProps) {
  const [scans, setScans] = useState<ScanHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const playAdvanceRef = useRef(false);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ businessId, mode });
      if (keywordId) params.set("keywordId", keywordId);
      if (locationId) params.set("locationId", locationId);
      if (gridSize) params.set("gridSize", String(gridSize));
      if (radiusMeters) params.set("radius", String(radiusMeters));
      if (competitorKey) params.set("competitorKey", competitorKey);

      const res = await fetch(`/api/scans/history?${params}`);
      const json = await res.json();
      if (!res.ok) return;
      const list = (json.scans ?? []) as ScanHistoryEntry[];
      setScans(list);
      const idx = list.findIndex((s) => s.scan_id === currentScanId);
      setIndex(idx >= 0 ? idx : Math.max(0, list.length - 1));
    } finally {
      setLoading(false);
    }
  }, [businessId, mode, keywordId, locationId, gridSize, radiusMeters, competitorKey]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    const idx = scans.findIndex((s) => s.scan_id === currentScanId);
    if (idx >= 0) setIndex(idx);
  }, [currentScanId, scans]);

  useEffect(() => {
    if (!onPrefetchScan || !scans.length) return;
    for (const offset of [-1, 1, -2, 2]) {
      const entry = scans[index + offset];
      if (entry) onPrefetchScan(entry.scan_id);
    }
  }, [index, scans, onPrefetchScan]);

  const current = scans[index] ?? null;

  useEffect(() => {
    if (!playing || scans.length < 2) return;
    const timer = setInterval(() => {
      playAdvanceRef.current = true;
      setIndex((i) => (i >= scans.length - 1 ? 0 : i + 1));
    }, 2000);
    return () => clearInterval(timer);
  }, [playing, scans.length]);

  useEffect(() => {
    if (!playAdvanceRef.current) return;
    playAdvanceRef.current = false;
    const entry = scans[index];
    if (entry) onScanSelect(entry.scan_id, entry);
  }, [index, scans, onScanSelect]);

  const selectIndex = (i: number) => {
    const entry = scans[i];
    if (!entry) return;
    setIndex(i);
    onScanSelect(entry.scan_id, entry);
  };

  const windowStart = useMemo(() => {
    if (scans.length <= WINDOW_SIZE) return 0;
    const half = Math.floor(WINDOW_SIZE / 2);
    return Math.max(0, Math.min(index - half, scans.length - WINDOW_SIZE));
  }, [index, scans.length]);

  const visibleScans = useMemo(
    () => scans.slice(windowStart, windowStart + WINDOW_SIZE),
    [scans, windowStart]
  );

  if (loading && !scans.length) {
    return (
      <div className={`flex items-center gap-2 text-xs text-text-muted ${className}`}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading timeline…
      </div>
    );
  }

  if (!scans.length) {
    return (
      <div
        className={`rounded-md border border-dashed border-border px-3.5 py-2 text-xs text-text-muted ${className}`}
      >
        No scan history yet.
      </div>
    );
  }

  return (
    <div className={`rounded-lg border border-zinc-200 bg-white px-3.5 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Timeline
          </span>
          {onModeChange && (
            <select
              value={mode}
              onChange={(e) => onModeChange(e.target.value as TimelineMode)}
              className="rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-[11px] text-zinc-800"
            >
              <option value="target">Scan history</option>
              <option value="competitor">Competitor maps</option>
              <option value="keyword">Keyword maps</option>
            </select>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={index <= 0}
            onClick={() => selectIndex(index - 1)}
            className="rounded border border-zinc-200 p-1 disabled:opacity-30"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={index >= scans.length - 1}
            onClick={() => selectIndex(index + 1)}
            className="rounded border border-zinc-200 p-1 disabled:opacity-30"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="rounded border border-zinc-200 p-1"
            title={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>
          <span className="text-[10px] tabular-nums text-zinc-500">
            {index + 1}/{scans.length}
          </span>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-center gap-4">
        {visibleScans.map((s, vi) => {
          const i = windowStart + vi;
          const active = i === index;
          return (
            <button
              key={s.scan_id}
              type="button"
              onClick={() => selectIndex(i)}
              className="group flex flex-col items-center gap-0.5"
              title={new Date(s.completed_at).toLocaleString()}
            >
              <span
                className={`rounded-full border-2 transition-all ${
                  active
                    ? "h-3 w-3 border-[#137752] bg-[#137752]"
                    : "h-2 w-2 border-zinc-300 bg-white group-hover:border-emerald-400"
                }`}
              />
              <span
                className={`text-[9px] ${active ? "font-semibold text-[#137752]" : "text-zinc-500"}`}
              >
                {new Date(s.completed_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
              {s.avg_rank != null && (
                <span
                  className={`text-[8px] tabular-nums ${active ? "font-medium text-zinc-700" : "text-zinc-400"}`}
                >
                  #{rankLabel(Math.round(s.avg_rank))}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
