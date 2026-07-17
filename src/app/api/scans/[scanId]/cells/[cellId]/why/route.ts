import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireScanAccess } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";
import { loadScanGridDataForCell } from "@/lib/maps/scan-queries";
import { buildCellWhyArtifact } from "@/lib/maps/workspace-artifacts";
import {
  WORKSPACE_CACHE_TYPES,
  cellWhyCacheKey,
  getWorkspaceCache,
  setWorkspaceCache,
} from "@/lib/maps/workspace-cache";
import type { CellWhyResult } from "@/lib/maps/cell-why";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ scanId: string; cellId: string }> }
) {
  try {
    const { scanId, cellId } = await params;
    const url = new URL(request.url);
    const keywordId = url.searchParams.get("keywordId");
    const entityKey = url.searchParams.get("entityKey") ?? "you";

    await requireScanAccess(scanId);
    const supabase = createServiceClient();
    const loaded = await loadScanGridDataForCell(supabase, scanId, cellId, keywordId);
    if (!loaded) return NextResponse.json({ error: "Cell not found" }, { status: 404 });

    const { gridData } = loaded;

    const kwId = gridData.activeKeyword?.id;
    if (kwId) {
      const cacheKey = cellWhyCacheKey(kwId, cellId, entityKey);
      const cached = await getWorkspaceCache<CellWhyResult>(
        supabase,
        scanId,
        WORKSPACE_CACHE_TYPES.CELL_WHY,
        cacheKey
      );
      if (cached) return NextResponse.json(cached);
    }

    const why = buildCellWhyArtifact(gridData, cellId, entityKey);
    if (!why) {
      return NextResponse.json({ error: "No raw results for this cell" }, { status: 404 });
    }

    if (kwId) {
      void setWorkspaceCache(
        supabase,
        scanId,
        WORKSPACE_CACHE_TYPES.CELL_WHY,
        cellWhyCacheKey(kwId, cellId, entityKey),
        why
      );
    }

    return NextResponse.json(why);
  } catch (err) {
    return httpErrorFromException(err, "Why analysis failed");
  }
}
