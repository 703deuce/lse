"use client";

import { useMemo } from "react";
import { generateGrid } from "@/lib/maps/grid";
import { gridScanMeta } from "@/lib/maps/grid-metrics";
import type { GridCell } from "@/components/maps/scan-map";

export function useMoveGridPreview(
  centerLat: number,
  centerLng: number,
  gridSize: number,
  radiusMeters: number
): GridCell[] {
  return useMemo(() => {
    const grid = generateGrid({ centerLat, centerLng, gridSize, radiusMeters });
    return grid.map((p) => ({
      label: p.label,
      lat: p.lat,
      lng: p.lng,
      rank: null,
      pending: true,
    }));
  }, [centerLat, centerLng, gridSize, radiusMeters]);
}

interface MoveGridPanelProps {
  centerLat: number;
  centerLng: number;
  gridSize: number;
  radiusMeters: number;
  onRunScan: () => void;
  onCancel: () => void;
  running?: boolean;
}

export function MoveGridPanel({
  centerLat,
  centerLng,
  gridSize,
  radiusMeters,
  onRunScan,
  onCancel,
  running,
}: MoveGridPanelProps) {
  const meta = gridScanMeta(gridSize, radiusMeters);

  return (
    <div className="mb-3 rounded-xl border border-blue-200 bg-blue-50/80 px-4 py-3 dark:border-blue-900 dark:bg-blue-950/40">
      <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">Move grid center</p>
      <p className="mt-1 text-xs text-blue-800 dark:text-blue-200">
        Drag the center pin or click the map. Preview bubbles show the new grid layout.
      </p>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-blue-900 dark:text-blue-100">
        <span>
          Center:{" "}
          <strong>
            {centerLat.toFixed(5)}, {centerLng.toFixed(5)}
          </strong>
        </span>
        <span>
          {meta.gridSize}×{meta.gridSize} · {meta.radiusMiles} mi radius · ~{meta.spacingMiles} mi
          spacing
        </span>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={running}
          onClick={onRunScan}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {running ? "Starting scan…" : "Run Scan Here"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-medium dark:border-blue-800"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
