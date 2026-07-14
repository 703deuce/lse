import { NextResponse } from "next/server";
import { requireScanAccess } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";
import { loadScanGridData } from "@/lib/maps/scan-queries";
import {
  buildEntityGridArtifact,
  entityGridResponseFromArtifact,
  type EntityGridPayload,
} from "@/lib/maps/workspace-artifacts";
import {
  WORKSPACE_CACHE_TYPES,
  entityGridCacheKey,
  getWorkspaceCache,
  setWorkspaceCache,
} from "@/lib/maps/workspace-cache";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ scanId: string }> }
) {
  try {
    const { scanId } = await params;
    const url = new URL(request.url);
    const entity = url.searchParams.get("entity") ?? "target";
    const entityKey =
      entity === "competitor"
        ? url.searchParams.get("entityKey") ?? url.searchParams.get("competitorKey")
        : "you";
    const keywordId = url.searchParams.get("keywordId");
    const resolvedEntityKey = entity === "target" ? "you" : entityKey ?? "you";

    await requireScanAccess(scanId);
    const supabase = createServiceClient();
    const gridData = await loadScanGridData(supabase, scanId, keywordId);
    if (!gridData) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    }

    const kwId = gridData.activeKeyword?.id;
    if (kwId) {
      const cacheKey = entityGridCacheKey(kwId, resolvedEntityKey);
      const cached = await getWorkspaceCache<EntityGridPayload>(
        supabase,
        scanId,
        WORKSPACE_CACHE_TYPES.ENTITY_GRID,
        cacheKey
      );
      if (cached) {
        return NextResponse.json(entityGridResponseFromArtifact(cached, gridData));
      }
    }

    const artifact = buildEntityGridArtifact(gridData, resolvedEntityKey);
    if (!artifact) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    }

    if (kwId) {
      void setWorkspaceCache(
        supabase,
        scanId,
        WORKSPACE_CACHE_TYPES.ENTITY_GRID,
        entityGridCacheKey(kwId, resolvedEntityKey),
        artifact
      );
    }

    return NextResponse.json(entityGridResponseFromArtifact(artifact, gridData));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Render failed";
    const status = message.includes("access denied") || message.includes("not found") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
