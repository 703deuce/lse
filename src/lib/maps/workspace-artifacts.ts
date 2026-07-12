import type { createServiceClient } from "@/lib/db/client";
import {
  buildCompetitorFingerprint,
  entityFromRawResult,
  findRawInResults,
  type CompetitorFingerprint,
} from "@/lib/competitors/fingerprint";
import { buildCellWhy, type CellWhyResult } from "@/lib/maps/cell-why";
import {
  buildEntityGridCells,
  buildYouEntity,
  compareEntityGrids,
  entitiesFromTopCompetitors,
  entityFromKey,
  findEntityInCompetitors,
  metricsFromCells,
  solvFromCells,
  type GridEntityRef,
  type StoredCompetitor,
} from "@/lib/maps/grid-entity";
import { buildGridTopCompetitors } from "@/lib/maps/grid";
import type { ScanGridData } from "@/lib/maps/scan-queries";
import type { BusinessRow, ScanPointRow, ScanResultRow } from "@/lib/db/types";

type ServiceClient = ReturnType<typeof createServiceClient>;

export type EntityGridPayload = {
  entity: GridEntityRef;
  cells: ReturnType<typeof buildEntityGridCells>;
};

export type ComparePayload = {
  mode: "competitors" | "scans";
  scanA: {
    id: string;
    keyword: { id: string; keyword: string } | null;
    createdAt: string;
    finishedAt: string | null;
    gridSize: number;
    radiusMeters: number;
  };
  scanB: {
    id: string;
    keyword: { id: string; keyword: string } | null;
    createdAt: string;
    finishedAt: string | null;
    gridSize: number;
    radiusMeters: number;
  };
  entityA: { key: string; label: string; isTarget: boolean };
  entityB: { key: string; label: string; isTarget: boolean };
  entities: Array<{ key: string; label: string; isTarget: boolean }>;
  cells: ReturnType<typeof compareEntityGrids>["cells"];
  summary: ReturnType<typeof compareEntityGrids>["summary"];
};

function loadEntitiesForScan(data: ScanGridData): { you: GridEntityRef; competitors: GridEntityRef[] } {
  const business = (data.business ?? {}) as BusinessRow;
  const you = buildYouEntity(business);
  const locationTokens = [data.activeKeyword?.city, data.activeKeyword?.state].filter(
    (t): t is string => !!t?.trim()
  );
  const results = data.results as ScanResultRow[];
  const topCompetitors = buildGridTopCompetitors(results, {
    excludeCid: business.cid,
    excludePlaceId: business.place_id,
    excludeName: business.name,
    targetCategory: business.primary_category,
    keyword: data.activeKeyword?.keyword,
    locationTokens,
    limit: 5,
  });
  return { you, competitors: entitiesFromTopCompetitors(topCompetitors, 5) };
}

function resolveEntity(key: string, you: GridEntityRef, competitors: GridEntityRef[]): GridEntityRef {
  if (key === "you") return you;
  return competitors.find((e) => e.key === key) ?? you;
}

export function buildEntityGridArtifact(data: ScanGridData, entityKey: string): EntityGridPayload | null {
  const business = (data.business ?? {}) as BusinessRow;
  const you = buildYouEntity(business);
  const points = data.points as ScanPointRow[];
  const results = data.results as ScanResultRow[];

  let entity: GridEntityRef = you;
  if (entityKey !== "you") {
    entity = entityFromKey(entityKey, entityKey);
    const locationTokens = [data.activeKeyword?.city, data.activeKeyword?.state].filter(
      (t): t is string => !!t?.trim()
    );
    const top = buildGridTopCompetitors(results, {
      excludeCid: business.cid,
      excludePlaceId: business.place_id,
      excludeName: business.name,
      keyword: data.activeKeyword?.keyword,
      locationTokens,
      limit: 10,
    });
    const found = entitiesFromTopCompetitors(top, 10).find((e) => e.key === entityKey);
    if (found) entity = found;
  }

  const cells = buildEntityGridCells(points, results, entity);
  return { entity, cells };
}

export function buildCellWhyArtifact(
  data: ScanGridData,
  cellId: string,
  entityKey: string
): CellWhyResult | null {
  const point = data.points.find((p) => p.id === cellId);
  if (!point) return null;

  const result = data.results.find((r) => r.scan_point_id === cellId);
  const competitors = (result?.top_competitors_json ?? []) as StoredCompetitor[];
  if (!competitors.length) return null;

  const you = buildYouEntity(data.business ?? {});
  const entity = entityKey === "you" ? you : entityFromKey(entityKey, entityKey);
  const match = findEntityInCompetitors(competitors, entity);
  const selected = match.matched ?? {
    name: entity.label,
    rank: match.rank,
    rating: null,
    review_count: null,
    category: null,
  };

  const keyword = data.activeKeyword ? String(data.activeKeyword.keyword).trim() : "";

  return buildCellWhy({
    keyword,
    cellLat: point.lat,
    cellLng: point.lng,
    selected: {
      ...selected,
      name: selected.name ?? entity.label,
    } as StoredCompetitor & { name: string },
    selectedRank: match.rank ?? (result?.target_rank as number | null),
    rawResults: competitors,
  });
}

export async function buildFingerprintArtifact(
  supabase: ServiceClient,
  params: {
    gridData: ScanGridData;
    entityKey: string;
    competitorId?: string | null;
    entity?: GridEntityRef | null;
    raw?: StoredCompetitor | null;
  }
): Promise<CompetitorFingerprint | null> {
  const { gridData } = params;
  const business = (gridData.business ?? {}) as BusinessRow;
  const points = gridData.points as ScanPointRow[];
  const results = gridData.results as ScanResultRow[];
  const keyword = gridData.activeKeyword ? String(gridData.activeKeyword.keyword).trim() : null;

  const centerLat =
    gridData.batch.center_lat ?? business.lat ?? points[Math.floor(points.length / 2)]?.lat ?? 0;
  const centerLng =
    gridData.batch.center_lng ?? business.lng ?? points[Math.floor(points.length / 2)]?.lng ?? 0;

  let entity = params.entity ?? null;
  let raw = params.raw ?? null;
  const competitorIdResolved = params.competitorId && params.competitorId !== "temp" ? params.competitorId : null;

  if (competitorIdResolved && !entity) {
    const { data: comp } = await supabase
      .from("competitors")
      .select("*")
      .eq("id", competitorIdResolved)
      .maybeSingle();
    if (comp) entity = entityFromRawResult(comp, comp.name);
  }

  if (!entity && params.entityKey) {
    entity = entityFromKey(params.entityKey, params.entityKey);
    const top = buildGridTopCompetitors(results, {
      excludeCid: business.cid,
      excludePlaceId: business.place_id,
      excludeName: business.name,
      keyword,
      limit: 10,
    });
    entity =
      entitiesFromTopCompetitors(top, 10).find((e) => e.key === params.entityKey) ??
      entityFromKey(params.entityKey, params.entityKey);
  }

  if (!entity) return null;
  if (!raw) raw = findRawInResults(results, entity);

  let snapshot = null;
  if (competitorIdResolved) {
    const { data } = await supabase
      .from("competitor_snapshots")
      .select("*")
      .eq("competitor_id", competitorIdResolved)
      .eq("scan_batch_id", gridData.batch.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    snapshot = data;
  }

  let momentum = null;
  if (competitorIdResolved) {
    const { data: entityRow } = await supabase
      .from("review_momentum_entities")
      .select("reviews_30d, days_since_last_review, momentum_score")
      .eq("competitor_id", competitorIdResolved)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (entityRow) {
      momentum = {
        reviewsLast30Days: entityRow.reviews_30d,
        daysSinceLastReview: entityRow.days_since_last_review,
        momentumScore: entityRow.momentum_score,
      };
    }
  }

  return buildCompetitorFingerprint({
    entity,
    raw,
    competitorId: competitorIdResolved,
    points,
    results,
    centerLat,
    centerLng,
    keyword,
    momentum,
    snapshot: snapshot
      ? {
          category: snapshot.category,
          additional_categories: (snapshot.additional_categories ?? []) as string[],
          rating: snapshot.rating,
          review_count: snapshot.review_count,
          services_json: (snapshot.services_json ?? {}) as Record<string, unknown>,
        }
      : null,
  });
}

export function buildCompareArtifact(
  dataA: ScanGridData,
  dataB: ScanGridData,
  params: {
    entityAKey: string;
    entityBKey: string;
    mode?: string | null;
  }
): ComparePayload {
  const entitiesA = loadEntitiesForScan(dataA);
  const entitiesB = dataA.batch.id === dataB.batch.id ? entitiesA : loadEntitiesForScan(dataB);

  const entityA = resolveEntity(params.entityAKey, entitiesA.you, entitiesA.competitors);
  const entityB = resolveEntity(params.entityBKey, entitiesB.you, entitiesB.competitors);
  const headToHead =
    params.mode === "competitors" ||
    (dataA.batch.id === dataB.batch.id && entityA.key !== entityB.key);

  const { cells, summary } = compareEntityGrids(
    dataA.points as ScanPointRow[],
    dataA.results as ScanResultRow[],
    dataB.points as ScanPointRow[],
    dataB.results as ScanResultRow[],
    entityA,
    entityB,
    { headToHead }
  );

  return {
    mode: headToHead ? "competitors" : "scans",
    scanA: {
      id: dataA.batch.id,
      keyword: dataA.activeKeyword
        ? { id: dataA.activeKeyword.id, keyword: String(dataA.activeKeyword.keyword).trim() }
        : null,
      createdAt: dataA.batch.created_at,
      finishedAt: dataA.batch.finished_at,
      gridSize: dataA.batch.grid_size,
      radiusMeters: dataA.batch.radius_meters,
    },
    scanB: {
      id: dataB.batch.id,
      keyword: dataB.activeKeyword
        ? { id: dataB.activeKeyword.id, keyword: String(dataB.activeKeyword.keyword).trim() }
        : null,
      createdAt: dataB.batch.created_at,
      finishedAt: dataB.batch.finished_at,
      gridSize: dataB.batch.grid_size,
      radiusMeters: dataB.batch.radius_meters,
    },
    entityA: { key: entityA.key, label: entityA.label, isTarget: entityA.isTarget ?? false },
    entityB: { key: entityB.key, label: entityB.label, isTarget: entityB.isTarget ?? false },
    entities: [entitiesA.you, ...entitiesA.competitors].map((e) => ({
      key: e.key,
      label: e.label,
      isTarget: e.isTarget ?? false,
    })),
    cells,
    summary,
  };
}

export function entityGridResponseFromArtifact(
  artifact: EntityGridPayload,
  data: ScanGridData
) {
  const metrics = metricsFromCells(artifact.cells);
  const solv = solvFromCells(artifact.cells);
  return {
    entity: artifact.entity,
    cells: artifact.cells,
    metrics,
    solv,
    scan: {
      id: data.batch.id,
      gridSize: data.batch.grid_size,
      radiusMeters: data.batch.radius_meters,
      centerLat: data.batch.center_lat,
      centerLng: data.batch.center_lng,
      completedAt: data.batch.finished_at ?? data.batch.created_at,
    },
    keyword: data.activeKeyword
      ? { id: data.activeKeyword.id, keyword: String(data.activeKeyword.keyword).trim() }
      : null,
  };
}
