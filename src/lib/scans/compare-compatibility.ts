export type ScanCompareAxes = {
  keyword?: string | null;
  gridSize?: number | null;
  radiusMeters?: number | null;
  centerLat?: number | null;
  centerLng?: number | null;
  businessId?: string | null;
};

export type CompareCompatibility = {
  compatible: boolean;
  warnings: string[];
};

function roundCoord(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.round(n * 1e5) / 1e5;
}

/**
 * Warn when comparing scans that differ in geometry, keyword, or target.
 * Does not block comparison — freelancers may still want a rough view.
 */
export function assessScanCompareCompatibility(
  a: ScanCompareAxes,
  b: ScanCompareAxes
): CompareCompatibility {
  const warnings: string[] = [];

  const kwA = (a.keyword ?? "").trim().toLowerCase();
  const kwB = (b.keyword ?? "").trim().toLowerCase();
  if (kwA && kwB && kwA !== kwB) {
    warnings.push("These scans use different keywords.");
  }

  if (
    a.gridSize != null &&
    b.gridSize != null &&
    Number(a.gridSize) !== Number(b.gridSize)
  ) {
    warnings.push("Grid sizes differ — cell-by-cell deltas can be misleading.");
  }

  if (
    a.radiusMeters != null &&
    b.radiusMeters != null &&
    Number(a.radiusMeters) !== Number(b.radiusMeters)
  ) {
    warnings.push("Search radius differs between these scans.");
  }

  const latA = roundCoord(a.centerLat);
  const latB = roundCoord(b.centerLat);
  const lngA = roundCoord(a.centerLng);
  const lngB = roundCoord(b.centerLng);
  if (latA != null && latB != null && lngA != null && lngB != null) {
    if (latA !== latB || lngA !== lngB) {
      warnings.push("Grid center points differ.");
    }
  }

  if (a.businessId && b.businessId && a.businessId !== b.businessId) {
    warnings.push("These scans target different businesses.");
  }

  return { compatible: warnings.length === 0, warnings };
}
