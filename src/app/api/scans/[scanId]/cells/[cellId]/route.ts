import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireScanAccess } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";
import {
  buildYouEntity,
  findEntityInCompetitors,
  parseGridLabel,
  type StoredCompetitor,
} from "@/lib/maps/grid-entity";
import { loadScanGridDataForCell } from "@/lib/maps/scan-queries";
import { profileFromBatch } from "@/lib/maps/scan-profiles";
import {
  pickScanResultForPoint,
  validateStoredCellResult,
} from "@/lib/maps/cell-result-integrity";
import { mapsDepth } from "@/lib/jobs/run-grid-cells";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ scanId: string; cellId: string }> }
) {
  try {
    const { scanId, cellId } = await params;
    const url = new URL(request.url);
    const keywordId = url.searchParams.get("keywordId");

    await requireScanAccess(scanId);
    const supabase = createServiceClient();
    const loaded = await loadScanGridDataForCell(supabase, scanId, cellId, keywordId);
    if (!loaded) return NextResponse.json({ error: "Cell not found" }, { status: 404 });

    const { gridData, point } = loaded;
    const result = pickScanResultForPoint(gridData.results, cellId);
    const competitors = (result?.top_competitors_json ?? []) as StoredCompetitor[];
    const serpValidation = validateStoredCellResult(result, mapsDepth());
    const { row, col } = parseGridLabel(point.grid_label);
    const you = buildYouEntity(gridData.business ?? {});
    const match = findEntityInCompetitors(competitors, you);
    const profile = profileFromBatch(gridData.batch);
    const confidence = (gridData.batch.confidence_summary ?? {}) as Record<string, unknown>;

    return NextResponse.json({
      cell: {
        id: point.id,
        label: point.grid_label,
        row,
        col,
        lat: point.lat,
        lng: point.lng,
        distanceFromCenterM: point.distance_from_center_m,
      },
      keyword: gridData.activeKeyword
        ? { id: gridData.activeKeyword.id, keyword: String(gridData.activeKeyword.keyword).trim() }
        : null,
      scan: {
        id: gridData.batch.id,
        gridSize: gridData.batch.grid_size,
        radiusMeters: gridData.batch.radius_meters,
        createdAt: gridData.batch.created_at,
        finishedAt: gridData.batch.finished_at,
        device: profile.device,
        os: profile.os,
        browser: profile.browser,
      },
      target: {
        rank: (result?.target_rank as number | null) ?? null,
        found: !!result?.target_found,
        matchReason: (result?.confidence as string | null) ?? match.matchReason,
        matchedResult: match.matched ?? null,
      },
      rawResults: competitors,
      resultCount: competitors.length,
      hasRawResults: competitors.length > 0,
      sparseResults: !serpValidation.complete,
      sparseReason: serpValidation.reason ?? null,
      checkUrl: (result?.check_url as string | null) ?? null,
      sourceTimestamp: (result?.source_timestamp as string | null) ?? null,
      provider: process.env.NODE_ENV === "development" ? gridData.batch.provider : undefined,
      debug:
        process.env.NODE_ENV === "development"
          ? {
              provider: gridData.batch.provider,
              confidenceSummary: confidence,
            }
          : undefined,
    });
  } catch (err) {
    return httpErrorFromException(err, "Cell fetch failed");
  }
}
