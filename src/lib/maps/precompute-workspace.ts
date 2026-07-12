import { createServiceClient } from "@/lib/db/client";
import { buildYouEntity, entitiesFromTopCompetitors } from "@/lib/maps/grid-entity";
import { buildGridTopCompetitors } from "@/lib/maps/grid";
import { loadScanGridData } from "@/lib/maps/scan-queries";
import {
  buildCellWhyArtifact,
  buildCompareArtifact,
  buildEntityGridArtifact,
  buildFingerprintArtifact,
} from "@/lib/maps/workspace-artifacts";
import {
  WORKSPACE_CACHE_TYPES,
  cellWhyCacheKey,
  compareCacheKey,
  entityGridCacheKey,
  fingerprintCacheKey,
  setWorkspaceCacheBatch,
} from "@/lib/maps/workspace-cache";
import type { BusinessRow, ScanResultRow } from "@/lib/db/types";

const PRECOMPUTE_COMPETITOR_LIMIT = 5;

export async function precomputeScanWorkspace(scanBatchId: string): Promise<void> {
  const supabase = createServiceClient();

  const { data: batch } = await supabase
    .from("scan_batches")
    .select("id, business_id, status")
    .eq("id", scanBatchId)
    .maybeSingle();

  if (!batch || batch.status === "failed") return;

  const { data: points } = await supabase
    .from("scan_points")
    .select("id")
    .eq("scan_batch_id", scanBatchId);
  const pointIds = (points ?? []).map((p) => p.id);
  if (!pointIds.length) return;

  const { data: keywordRows } = await supabase
    .from("scan_results")
    .select("keyword_id")
    .in("scan_point_id", pointIds);

  const keywordIds = [
    ...new Set((keywordRows ?? []).map((r) => r.keyword_id as string).filter(Boolean)),
  ];
  if (!keywordIds.length) return;

  const { data: competitors } = await supabase
    .from("competitors")
    .select("id, cid, place_id, name")
    .eq("business_id", batch.business_id);

  const cacheRows: Array<{
    scanBatchId: string;
    cacheType: (typeof WORKSPACE_CACHE_TYPES)[keyof typeof WORKSPACE_CACHE_TYPES];
    cacheKey: string;
    payload: unknown;
  }> = [];

  for (const keywordId of keywordIds) {
    const gridData = await loadScanGridData(supabase, scanBatchId, keywordId);
    if (!gridData?.activeKeyword) continue;

    const business = (gridData.business ?? {}) as BusinessRow;
    const results = gridData.results as ScanResultRow[];
    const keyword = String(gridData.activeKeyword.keyword).trim();

    const topCompetitors = buildGridTopCompetitors(results, {
      excludeCid: business.cid,
      excludePlaceId: business.place_id,
      excludeName: business.name,
      targetCategory: business.primary_category,
      keyword,
      limit: PRECOMPUTE_COMPETITOR_LIMIT,
    });

    const you = buildYouEntity(business);
    const competitorEntities = entitiesFromTopCompetitors(topCompetitors, PRECOMPUTE_COMPETITOR_LIMIT);
    const entityKeys = [you.key, ...competitorEntities.map((e) => e.key)];

    for (const entityKey of entityKeys) {
      const artifact = buildEntityGridArtifact(gridData, entityKey);
      if (!artifact) continue;
      cacheRows.push({
        scanBatchId,
        cacheType: WORKSPACE_CACHE_TYPES.ENTITY_GRID,
        cacheKey: entityGridCacheKey(keywordId, entityKey),
        payload: artifact,
      });
    }

    for (const point of gridData.points) {
      const why = buildCellWhyArtifact(gridData, point.id, you.key);
      if (!why) continue;
      cacheRows.push({
        scanBatchId,
        cacheType: WORKSPACE_CACHE_TYPES.CELL_WHY,
        cacheKey: cellWhyCacheKey(keywordId, point.id, you.key),
        payload: why,
      });
    }

    for (const compEntity of competitorEntities) {
      const entityKey = compEntity.key;
      const matchedCompetitor =
        (competitors ?? []).find(
          (c) =>
            (compEntity.cid && c.cid === compEntity.cid) ||
            (compEntity.place_id && c.place_id === compEntity.place_id) ||
            c.name === compEntity.name
        ) ?? null;

      const fingerprint = await buildFingerprintArtifact(supabase, {
        gridData,
        entityKey,
        competitorId: matchedCompetitor?.id ?? null,
      });
      if (!fingerprint) continue;

      cacheRows.push({
        scanBatchId,
        cacheType: WORKSPACE_CACHE_TYPES.FINGERPRINT,
        cacheKey: fingerprintCacheKey(keywordId, entityKey, matchedCompetitor?.id ?? null),
        payload: fingerprint,
      });

      const compare = buildCompareArtifact(gridData, gridData, {
        entityAKey: you.key,
        entityBKey: entityKey,
        mode: "competitors",
      });
      cacheRows.push({
        scanBatchId,
        cacheType: WORKSPACE_CACHE_TYPES.COMPARE,
        cacheKey: compareCacheKey(
          scanBatchId,
          keywordId,
          keywordId,
          "competitors",
          you.key,
          entityKey
        ),
        payload: compare,
      });
    }
  }

  const chunkSize = 50;
  for (let i = 0; i < cacheRows.length; i += chunkSize) {
    await setWorkspaceCacheBatch(supabase, cacheRows.slice(i, i + chunkSize));
  }
}
