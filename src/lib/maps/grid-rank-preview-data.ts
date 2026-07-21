import {
  buildYouEntity,
  compareEntityGrids,
  entitiesFromTopCompetitors,
  findEntityInCompetitors,
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
    place_id: "preview-place-ace",
    category: "Junk removal service",
    rating: 4.7,
    review_count: 214,
    phone: "(703) 555-0101",
    url: "https://acehaul.example",
    main_image: "https://picsum.photos/seed/ace-haul/96/96",
    total_photos: 48,
    lat: CENTER_LAT + 0.002,
    lng: CENTER_LNG - 0.001,
    address: "210 Occoquan Rd, Woodbridge, VA",
  },
  {
    name: "Quick Clear Services",
    cid: "preview-comp-quick",
    place_id: "preview-place-quick",
    category: "Waste management service",
    rating: 4.5,
    review_count: 128,
    phone: "(703) 555-0188",
    url: "https://quickclear.example",
    main_image: "https://picsum.photos/seed/quick-clear/96/96",
    total_photos: 22,
    lat: CENTER_LAT - 0.0015,
    lng: CENTER_LNG + 0.002,
    address: "44 Dale Blvd, Woodbridge, VA",
  },
  {
    name: "Woodbridge Disposal Co",
    cid: "preview-comp-wood",
    place_id: "preview-place-wood",
    category: "Garbage collection service",
    rating: 4.3,
    review_count: 89,
    phone: "(703) 555-0166",
    url: "https://wbdisposal.example",
    main_image: "https://picsum.photos/seed/wood-disposal/96/96",
    total_photos: 15,
    lat: CENTER_LAT + 0.003,
    lng: CENTER_LNG + 0.0025,
    address: "901 Potomac Path, Woodbridge, VA",
  },
];

const EXTRA_LISTINGS: StoredCompetitor[] = [
  {
    name: "Potomac Junk Pros",
    cid: "preview-comp-potomac",
    place_id: "preview-place-potomac",
    category: "Junk removal service",
    rating: 4.6,
    review_count: 97,
    phone: "(703) 555-0122",
    url: "https://potomacjunk.example",
    main_image: "https://picsum.photos/seed/potomac-junk/96/96",
    total_photos: 31,
    lat: CENTER_LAT - 0.0025,
    lng: CENTER_LNG - 0.002,
    address: "118 River Ridge Dr, Woodbridge, VA",
  },
  {
    name: "Same Day Haul VA",
    cid: "preview-comp-sameday",
    place_id: "preview-place-sameday",
    category: "Moving company",
    rating: 4.4,
    review_count: 61,
    phone: "(703) 555-0199",
    url: "https://samedayhaul.example",
    main_image: "https://picsum.photos/seed/same-day/96/96",
    total_photos: 18,
    lat: CENTER_LAT + 0.001,
    lng: CENTER_LNG + 0.0035,
    address: "55 Smoketown Rd, Woodbridge, VA",
  },
  {
    name: "Capitol Cleanouts",
    cid: "preview-comp-capitol",
    place_id: "preview-place-capitol",
    category: "Junk removal service",
    rating: 4.2,
    review_count: 143,
    phone: "(703) 555-0177",
    url: "https://capitolclean.example",
    main_image: "https://picsum.photos/seed/capitol-clean/96/96",
    total_photos: 40,
    lat: CENTER_LAT - 0.0035,
    lng: CENTER_LNG + 0.001,
    address: "3300 Prince William Pkwy, Woodbridge, VA",
  },
  {
    name: "Fairfax Rubbish Runners",
    cid: "preview-comp-fairfax",
    place_id: "preview-place-fairfax",
    category: "Waste management service",
    rating: 4.1,
    review_count: 54,
    phone: "(703) 555-0133",
    url: "https://fairfaxrubbish.example",
    main_image: "https://picsum.photos/seed/fairfax-rubbish/96/96",
    total_photos: 12,
    lat: CENTER_LAT + 0.004,
    lng: CENTER_LNG - 0.003,
    address: "12 Old Bridge Rd, Woodbridge, VA",
  },
  {
    name: "Northern VA Bin Guys",
    cid: "preview-comp-bin",
    place_id: "preview-place-bin",
    category: "Trash removal service",
    rating: 4.0,
    review_count: 38,
    phone: "(703) 555-0144",
    url: "https://nvabinguys.example",
    main_image: "https://picsum.photos/seed/bin-guys/96/96",
    total_photos: 9,
    lat: CENTER_LAT - 0.004,
    lng: CENTER_LNG - 0.0015,
    address: "780 Gordon Blvd, Woodbridge, VA",
  },
];

function buildTopCompetitors(yourRank: number, pointIndex: number): StoredCompetitor[] {
  const you: StoredCompetitor = {
    name: BUSINESS.name,
    cid: BUSINESS.cid,
    place_id: BUSINESS.place_id,
    rank: yourRank,
    category: BUSINESS.primary_category,
    rating: 4.8,
    review_count: 156,
    phone: BUSINESS.phone,
    url: BUSINESS.website_url,
    main_image: "https://picsum.photos/seed/premier-junk/96/96",
    total_photos: 64,
    lat: BUSINESS.lat,
    lng: BUSINESS.lng,
    address: "123 Commerce St, Woodbridge, VA",
  };

  const pack = [...COMPETITORS, ...EXTRA_LISTINGS].map((c, i) => {
    const offset = ((pointIndex + i) % 7) - 2;
    return {
      ...c,
      rank: Math.max(1, Math.min(20, yourRank + offset + (i === 0 ? -1 : i))),
    };
  });

  // Sort by rank and ensure "you" is inserted at yourRank
  const others = pack
    .map((c, i) => ({
      ...c,
      rank: c.rank === yourRank ? yourRank + 1 + (i % 3) : c.rank!,
    }))
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));

  const merged = [...others.slice(0, yourRank - 1), you, ...others.slice(yourRank - 1)].slice(
    0,
    12
  );
  return merged.map((c, i) => ({ ...c, rank: i + 1 }));
}

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
        distance_from_center_m: 0,
      });
    }
  }
  return points;
}

function rankForCell(row: number, col: number, variant: "older" | "current") {
  const dist = Math.abs(row - 2) + Math.abs(col - 2);
  const base = Math.min(20, dist + 1 + ((row + col) % 2));
  return variant === "current" ? Math.max(1, base - 1) : base;
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
  defaultAddress: "13327 Kirkdale Ct, Woodbridge, VA 22193",
  businessName: BUSINESS.name,
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

/** Cell inspector payload for /dev/grid-rank-preview (no backend). */
export function gridRankPreviewCell(scanId: string, cellId: string) {
  const status = gridRankPreviewStatusForScan(scanId);
  const point = status.points.find((p) => p.id === cellId) ?? status.points[12] ?? status.points[0];
  const result = status.results.find((r) => r.scan_point_id === point?.id) ?? status.results[0];
  const competitors = (result?.top_competitors_json ?? []) as StoredCompetitor[];
  const you = buildYouEntity(BUSINESS);
  const match = findEntityInCompetitors(competitors, you);
  const { row, col } = parseLabel(point?.grid_label ?? "C3");

  return {
    cell: {
      id: point?.id ?? cellId,
      label: point?.grid_label ?? "C3",
      row,
      col,
      lat: point?.lat ?? CENTER_LAT,
      lng: point?.lng ?? CENTER_LNG,
      distanceFromCenterM: point?.distance_from_center_m ?? 0,
    },
    keyword: { id: GRID_RANK_PREVIEW_KEYWORD_ID, keyword: KEYWORD },
    scan: {
      id: scanId,
      gridSize: GRID_SIZE,
      radiusMeters: RADIUS_METERS,
      createdAt: status.batch.created_at,
      finishedAt: status.batch.finished_at,
    },
    target: {
      rank: (result?.target_rank as number | null) ?? null,
      found: true,
      matchReason: "cid",
      matchedResult: match.matched ?? competitors.find((c) => c.cid === BUSINESS.cid) ?? null,
    },
    rawResults: competitors,
    resultCount: competitors.length,
    hasRawResults: competitors.length > 0,
    sparseResults: false,
    sparseReason: null,
    checkUrl: `https://www.google.com/maps/search/${encodeURIComponent(KEYWORD)}`,
    sourceTimestamp: status.batch.finished_at,
  };
}
