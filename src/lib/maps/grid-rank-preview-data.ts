import {
  buildYouEntity,
  compareEntityGrids,
  entitiesFromTopCompetitors,
  type StoredCompetitor,
} from "@/lib/maps/grid-entity";
import { computeSolv } from "@/lib/maps/grid-metrics";
import type { ComparePayload } from "@/lib/maps/workspace-artifacts";

export const GRID_RANK_PREVIEW_BUSINESS_ID = "preview";
export const GRID_RANK_PREVIEW_SCAN_A = "preview-scan-a";
export const GRID_RANK_PREVIEW_SCAN_B = "preview-scan-b";
export const GRID_RANK_PREVIEW_KEYWORD_ID = "preview-kw-1";

const BUSINESS = {
  name: "Premier Junk Removal",
  cid: "preview-cid-you",
  place_id: "preview-place-you",
  lat: 38.6431,
  lng: -77.3054,
  scan_center_lat: 38.6431,
  scan_center_lng: -77.3054,
  primary_category: "Junk removal service",
  phone: "(703) 555-0142",
  website_url: "https://premierjunk.example",
};

const KEYWORD = "junk removal woodbridge va";
const GRID_SIZE = 5;
const RADIUS_METERS = 3219;
const CENTER_LAT = 38.6431;
const CENTER_LNG = -77.3054;
const SPACING = 0.0075;

const COMPETITORS: StoredCompetitor[] = [
  {
    name: "Ace Haul & Junk",
    cid: "preview-comp-ace",
    category: "Junk removal service",
    rating: 4.7,
    review_count: 214,
  },
  {
    name: "Quick Clear Services",
    cid: "preview-comp-quick",
    category: "Waste management service",
    rating: 4.5,
    review_count: 128,
  },
  {
    name: "Woodbridge Disposal Co",
    cid: "preview-comp-wood",
    category: "Garbage collection service",
    rating: 4.3,
    review_count: 89,
  },
];

function gridLabel(row: number, col: number) {
  return `${String.fromCharCode(65 + row)}${col + 1}`;
}

function generatePoints(scanId: string) {
  const mid = Math.floor(GRID_SIZE / 2);
  const points = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const label = gridLabel(row, col);
      points.push({
        id: `pt-${scanId}-${label}`,
        scan_batch_id: scanId,
        grid_label: label,
        lat: CENTER_LAT + (row - mid) * SPACING,
        lng: CENTER_LNG + (col - mid) * SPACING,
        row_index: row,
        col_index: col,
      });
    }
  }
  return points;
}

function rankForCell(row: number, col: number, variant: "older" | "current") {
  const dist = Math.abs(row - 2) + Math.abs(col - 2);
  const base = Math.min(20, dist + 1 + (row + col) % 2);
  return variant === "current" ? Math.max(1, base - 1) : base;
}

function buildTopCompetitors(yourRank: number, pointIndex: number): StoredCompetitor[] {
  const aceRank = Math.max(1, yourRank + ((pointIndex % 3) - 1));
  const quickRank = Math.max(1, yourRank + 1);
  return [
    { ...COMPETITORS[0], rank: aceRank },
    { ...COMPETITORS[1], rank: quickRank },
    { ...COMPETITORS[2], rank: Math.min(20, quickRank + 2) },
    {
      name: BUSINESS.name,
      cid: BUSINESS.cid,
      place_id: BUSINESS.place_id,
      rank: yourRank,
      category: BUSINESS.primary_category,
      rating: 4.8,
      review_count: 156,
    },
  ];
}

function generateResults(
  points: ReturnType<typeof generatePoints>,
  variant: "older" | "current"
) {
  return points.map((p, i) => {
    const { row, col } = parseLabel(p.grid_label);
    const targetRank = rankForCell(row, col, variant);
    return {
      id: `res-${p.id}`,
      scan_point_id: p.id,
      keyword_id: GRID_RANK_PREVIEW_KEYWORD_ID,
      target_rank: targetRank,
      target_found: true,
      confidence: "high",
      top_competitors_json: buildTopCompetitors(targetRank, i),
    };
  });
}

function parseLabel(label: string) {
  const match = /^([A-Z])(\d+)$/i.exec(label);
  if (!match) return { row: 0, col: 0 };
  return { row: match[1].toUpperCase().charCodeAt(0) - 65, col: Number(match[2]) - 1 };
}

function aggregateFromResults(results: ReturnType<typeof generateResults>) {
  const ranks = results.map((r) => r.target_rank ?? 21);
  const top3 = ranks.filter((r) => r <= 3).length;
  const top10 = ranks.filter((r) => r <= 10).length;
  const top20 = ranks.filter((r) => r <= 20).length;
  const found = ranks.filter((r) => r <= 20);
  const avg = found.length
    ? Math.round((found.reduce((a, b) => a + b, 0) / found.length) * 10) / 10
    : null;
  return {
    averageRank: avg,
    top3Cells: top3,
    top10Cells: top10,
    top20Cells: top20,
    totalCells: results.length,
    visibilityScore: Math.round((top10 / results.length) * 100),
    notFoundCells: results.length - found.length,
  };
}

const POINTS_A = generatePoints(GRID_RANK_PREVIEW_SCAN_A);
const POINTS_B = generatePoints(GRID_RANK_PREVIEW_SCAN_B);
const RESULTS_A = generateResults(POINTS_A, "older");
const RESULTS_B = generateResults(POINTS_B, "current");
const METRICS_B = aggregateFromResults(RESULTS_B);

const YOU = buildYouEntity(BUSINESS);
const COMPETITOR_ENTITIES = entitiesFromTopCompetitors(COMPETITORS, 3);

function batchFor(
  scanId: string,
  createdAt: string,
  finishedAt: string,
  metrics: ReturnType<typeof aggregateFromResults>
) {
  return {
    id: scanId,
    business_id: GRID_RANK_PREVIEW_BUSINESS_ID,
    status: "ready",
    grid_size: GRID_SIZE,
    radius_meters: RADIUS_METERS,
    device: "mobile",
    os: "android",
    browser: "chrome",
    created_at: createdAt,
    finished_at: finishedAt,
    center_lat: CENTER_LAT,
    center_lng: CENTER_LNG,
    center_label: "Business location",
    map_renderable: true,
    cells_completed: GRID_SIZE * GRID_SIZE,
    cells_total: GRID_SIZE * GRID_SIZE,
    cells_failed: 0,
    aggregate_metrics: metrics,
    confidence_summary: {
      keyword_ids: [GRID_RANK_PREVIEW_KEYWORD_ID],
      keyword_label: KEYWORD,
      completed_cells: GRID_SIZE * GRID_SIZE,
      total_cells: GRID_SIZE * GRID_SIZE,
    },
  };
}

export const gridRankPreviewStatus = {
  batch: batchFor(
    GRID_RANK_PREVIEW_SCAN_B,
    "2026-07-08T14:30:00.000Z",
    "2026-07-08T14:42:00.000Z",
    METRICS_B
  ),
  business: BUSINESS,
  primaryKeyword: KEYWORD,
  primaryKeywordId: GRID_RANK_PREVIEW_KEYWORD_ID,
  scanKeywordId: GRID_RANK_PREVIEW_KEYWORD_ID,
  primaryKeywordCity: "Woodbridge",
  primaryKeywordState: "VA",
  keywords: [
    {
      id: GRID_RANK_PREVIEW_KEYWORD_ID,
      keyword: KEYWORD,
      is_primary: true,
      city: "Woodbridge",
      state: "VA",
    },
    {
      id: "preview-kw-2",
      keyword: "furniture removal woodbridge",
      is_primary: false,
    },
  ],
  points: POINTS_B,
  results: RESULTS_B,
  priorMetrics: aggregateFromResults(RESULTS_A),
};

export const gridRankPreviewLatest = {
  keywords: [
    {
      id: GRID_RANK_PREVIEW_KEYWORD_ID,
      keyword: KEYWORD,
      lastScannedAt: "2026-07-08T14:42:00.000Z",
      latestScanId: GRID_RANK_PREVIEW_SCAN_B,
      latestRank: METRICS_B.averageRank,
      solv: computeSolv(METRICS_B.top3Cells, METRICS_B.totalCells),
    },
    {
      id: "preview-kw-2",
      keyword: "furniture removal woodbridge",
      lastScannedAt: null,
      latestScanId: null,
      latestRank: null,
      solv: null,
    },
  ],
};

export const gridRankPreviewLocations = {
  locations: [
    {
      id: "business",
      name: "Business location",
      address: "123 Commerce St, Woodbridge, VA",
      lat: CENTER_LAT,
      lng: CENTER_LNG,
      latestScanId: GRID_RANK_PREVIEW_SCAN_B,
      lastScannedAt: "2026-07-08T14:42:00.000Z",
    },
  ],
};

export const gridRankPreviewCompetitors = {
  entities: [
    { key: "you", label: "You", isTarget: true },
    ...COMPETITOR_ENTITIES.map((e) => ({
      key: e.key,
      label: e.label,
      isTarget: false,
    })),
  ],
};

export const gridRankPreviewHistory = {
  scans: [
    {
      scan_id: GRID_RANK_PREVIEW_SCAN_A,
      keyword: KEYWORD,
      keyword_id: GRID_RANK_PREVIEW_KEYWORD_ID,
      location_id: null,
      center_lat: CENTER_LAT,
      center_lng: CENTER_LNG,
      center_label: "Business location",
      grid_size: GRID_SIZE,
      radius_meters: RADIUS_METERS,
      completed_at: "2026-06-24T10:15:00.000Z",
      avg_rank: aggregateFromResults(RESULTS_A).averageRank,
      top3_count: aggregateFromResults(RESULTS_A).top3Cells,
      visibility_score: aggregateFromResults(RESULTS_A).visibilityScore,
      solv: computeSolv(
        aggregateFromResults(RESULTS_A).top3Cells,
        aggregateFromResults(RESULTS_A).totalCells
      ),
    },
    {
      scan_id: GRID_RANK_PREVIEW_SCAN_B,
      keyword: KEYWORD,
      keyword_id: GRID_RANK_PREVIEW_KEYWORD_ID,
      location_id: null,
      center_lat: CENTER_LAT,
      center_lng: CENTER_LNG,
      center_label: "Business location",
      grid_size: GRID_SIZE,
      radius_meters: RADIUS_METERS,
      completed_at: "2026-07-08T14:42:00.000Z",
      avg_rank: METRICS_B.averageRank,
      top3_count: METRICS_B.top3Cells,
      visibility_score: METRICS_B.visibilityScore,
      solv: computeSolv(METRICS_B.top3Cells, METRICS_B.totalCells),
    },
  ],
};

export const gridRankPreviewBusinessScans = {
  scans: [
    {
      id: GRID_RANK_PREVIEW_SCAN_A,
      created_at: "2026-06-24T10:15:00.000Z",
      keyword: KEYWORD,
    },
    {
      id: GRID_RANK_PREVIEW_SCAN_B,
      created_at: "2026-07-08T14:42:00.000Z",
      keyword: KEYWORD,
    },
  ],
};

function buildCompare(mode: "scans" | "competitors", entityBKey?: string): ComparePayload {
  const entityB =
    mode === "competitors" && entityBKey
      ? COMPETITOR_ENTITIES.find((e) => e.key === entityBKey) ?? COMPETITOR_ENTITIES[0]
      : YOU;

  const { cells, summary } = compareEntityGrids(
    POINTS_A,
    RESULTS_A,
    POINTS_B,
    RESULTS_B,
    YOU,
    entityB,
    { headToHead: mode === "competitors" }
  );

  return {
    mode,
    scanA: {
      id: GRID_RANK_PREVIEW_SCAN_A,
      keyword: { id: GRID_RANK_PREVIEW_KEYWORD_ID, keyword: KEYWORD },
      createdAt: "2026-06-24T10:15:00.000Z",
      finishedAt: "2026-06-24T10:28:00.000Z",
      gridSize: GRID_SIZE,
      radiusMeters: RADIUS_METERS,
    },
    scanB: {
      id: GRID_RANK_PREVIEW_SCAN_B,
      keyword: { id: GRID_RANK_PREVIEW_KEYWORD_ID, keyword: KEYWORD },
      createdAt: "2026-07-08T14:30:00.000Z",
      finishedAt: "2026-07-08T14:42:00.000Z",
      gridSize: GRID_SIZE,
      radiusMeters: RADIUS_METERS,
    },
    entityA: { key: YOU.key, label: BUSINESS.name ?? "You", isTarget: true },
    entityB: {
      key: entityB.key,
      label: entityB.isTarget ? (BUSINESS.name ?? "You") : entityB.label,
      isTarget: !!entityB.isTarget,
    },
    entities: [
      { key: YOU.key, label: "You", isTarget: true },
      ...COMPETITOR_ENTITIES.map((e) => ({
        key: e.key,
        label: e.label,
        isTarget: false,
      })),
    ],
    cells,
    summary,
  };
}

export function gridRankPreviewCompare(url: string): ComparePayload {
  const params = new URL(url, "http://localhost").searchParams;
  const mode = params.get("mode") === "competitors" ? "competitors" : "scans";
  const entityB = params.get("entityB") ?? COMPETITOR_ENTITIES[0]?.key;
  return buildCompare(mode, entityB ?? undefined);
}

export const gridRankPreviewScansHub = {
  scans: [
    {
      id: GRID_RANK_PREVIEW_SCAN_B,
      status: "ready",
      grid_size: GRID_SIZE,
      radius_meters: RADIUS_METERS,
      created_at: "2026-07-08T14:30:00.000Z",
      finished_at: "2026-07-08T14:42:00.000Z",
      center_label: "Business location",
      keyword: KEYWORD,
      keyword_id: GRID_RANK_PREVIEW_KEYWORD_ID,
      aggregate_metrics: METRICS_B,
    },
    {
      id: GRID_RANK_PREVIEW_SCAN_A,
      status: "ready",
      grid_size: GRID_SIZE,
      radius_meters: RADIUS_METERS,
      created_at: "2026-06-24T10:15:00.000Z",
      finished_at: "2026-06-24T10:28:00.000Z",
      center_label: "Business location",
      keyword: KEYWORD,
      keyword_id: GRID_RANK_PREVIEW_KEYWORD_ID,
      aggregate_metrics: aggregateFromResults(RESULTS_A),
    },
  ],
  keywords: gridRankPreviewLatest.keywords.map((k) => ({
    id: k.id,
    keyword: k.keyword,
    is_primary: k.id === GRID_RANK_PREVIEW_KEYWORD_ID,
  })),
  defaultCenterLat: CENTER_LAT,
  defaultCenterLng: CENTER_LNG,
};

export function gridRankPreviewStatusForScan(scanId: string) {
  if (scanId === GRID_RANK_PREVIEW_SCAN_A) {
    return {
      ...gridRankPreviewStatus,
      batch: batchFor(
        GRID_RANK_PREVIEW_SCAN_A,
        "2026-06-24T10:15:00.000Z",
        "2026-06-24T10:28:00.000Z",
        aggregateFromResults(RESULTS_A)
      ),
      points: POINTS_A,
      results: RESULTS_A,
    };
  }
  return gridRankPreviewStatus;
}
