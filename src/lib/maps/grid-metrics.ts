const METERS_PER_MILE = 1609.344;

export const GRID_SIZE_OPTIONS = [3, 5, 7, 9, 11] as const;
export const RADIUS_MILE_PRESETS = [
  { label: "1 mile (dense urban)", miles: 1 },
  { label: "2 miles (urban)", miles: 2 },
  { label: "5 miles (suburban — recommended)", miles: 5 },
  { label: "10 miles (rural / wide area)", miles: 10 },
] as const;

export const DEFAULT_GRID_SIZE = 7;
export const DEFAULT_RADIUS_METERS = Math.round(5 * METERS_PER_MILE);

export function milesToMeters(miles: number): number {
  return Math.round(miles * METERS_PER_MILE);
}

export function metersToMiles(meters: number): number {
  return Math.round((meters / METERS_PER_MILE) * 100) / 100;
}

export function gridScanMeta(gridSize: number, radiusMeters: number) {
  const spacingMeters = gridSize > 1 ? (2 * radiusMeters) / (gridSize - 1) : 0;
  const radiusMiles = metersToMiles(radiusMeters);
  const spacingMiles = metersToMiles(spacingMeters);
  const coverageSqMi = Math.round(Math.PI * radiusMiles * radiusMiles * 100) / 100;
  return {
    gridSize,
    radiusMeters,
    radiusMiles,
    spacingMeters,
    spacingMiles,
    coverageSqMi,
    cellCount: gridSize * gridSize,
    ringDistancesMiles: gridRingDistancesMiles(gridSize, radiusMeters),
  };
}

/** Chebyshev ring index from grid center (0 = center pin, 1 = first ring, …). */
export function gridCellRingIndex(row: number, col: number, gridSize: number): number {
  const half = Math.floor(gridSize / 2);
  return Math.max(Math.abs(row - half), Math.abs(col - half));
}

/**
 * Cardinal-direction bubble distances from scan center — one circle per grid ring.
 * Outer ring equals the scan radius (edge pins on N/S/E/W).
 */
export function gridRingDistancesMiles(gridSize: number, radiusMeters: number): number[] {
  const half = Math.floor(gridSize / 2);
  if (half <= 0 || gridSize <= 1) return [];
  const spacingM = (2 * radiusMeters) / (gridSize - 1);
  return Array.from({ length: half }, (_, i) => metersToMiles((i + 1) * spacingM));
}

export function formatRingMilesLabel(miles: number): string {
  if (miles < 10) return `${Math.round(miles * 100) / 100} mi`;
  return `${Math.round(miles * 10) / 10} mi`;
}

export function gridRingCheckboxLabel(gridSize: number, radiusMeters: number): string {
  const rings = gridRingDistancesMiles(gridSize, radiusMeters);
  if (rings.length === 0) return "Grid distance rings";
  return `Grid rings (${rings.map(formatRingMilesLabel).join(" / ")})`;
}

export function gridRingBucketLabel(
  ringIndex: number,
  ringMiles: number[],
  gridSize: number
): string {
  if (ringIndex === 0) return "Center pin";
  const miles = ringMiles[ringIndex - 1];
  const half = Math.floor(gridSize / 2);
  const edge = ringIndex === half ? " (edge)" : "";
  return `~${formatRingMilesLabel(miles)}${edge}`;
}

/** Share of Local Voice — % of grid cells where business ranks in top 3 (map pack). */
export function computeSolv(top3Cells: number, totalCells: number): number {
  if (totalCells <= 0) return 0;
  return Math.round((top3Cells / totalCells) * 10000) / 100;
}

/**
 * Weighted SoLV — partial credit by rank position (ranks 1–20).
 * Each cell contributes (21 − rank) / 20; 20+ or not found = 0.
 * Useful when comparing to tools that soften the top-3 cutoff.
 */
export function computeWeightedSolv(ranks: Array<number | null>): number {
  if (ranks.length === 0) return 0;
  let sum = 0;
  for (const rank of ranks) {
    if (rank == null || rank > 20) continue;
    sum += (21 - rank) / 20;
  }
  return Math.round((sum / ranks.length) * 10000) / 100;
}

export function rankLabel(rank: number | null): string {
  if (rank == null) return "—";
  if (rank > 20) return "20+";
  return String(rank);
}
