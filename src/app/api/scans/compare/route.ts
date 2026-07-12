import { NextResponse } from "next/server";
import { requireScanAccess } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";
import { loadScanGridData } from "@/lib/maps/scan-queries";
import { buildCompareArtifact, type ComparePayload } from "@/lib/maps/workspace-artifacts";
import {
  WORKSPACE_CACHE_TYPES,
  compareCacheKey,
  getWorkspaceCache,
  setWorkspaceCache,
} from "@/lib/maps/workspace-cache";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const scanAId = url.searchParams.get("scanA");
    const scanBId = url.searchParams.get("scanB");
    const keywordIdA = url.searchParams.get("keywordIdA");
    const keywordIdB = url.searchParams.get("keywordIdB");
    const mode = url.searchParams.get("mode") ?? "scans";
    const entityKey = url.searchParams.get("entityKey");
    const entityAKey = url.searchParams.get("entityA") ?? entityKey ?? "you";
    const entityBKey = url.searchParams.get("entityB") ?? entityKey ?? "you";

    if (!scanAId || !scanBId) {
      return NextResponse.json({ error: "scanA and scanB required" }, { status: 400 });
    }

    await requireScanAccess(scanAId);
    await requireScanAccess(scanBId);

    const supabase = createServiceClient();

    const headToHead =
      mode === "competitors" || (scanAId === scanBId && entityAKey !== entityBKey);
    const resolvedMode = headToHead ? "competitors" : "scans";

    const [dataA, dataB] = await Promise.all([
      loadScanGridData(supabase, scanAId, keywordIdA),
      loadScanGridData(supabase, scanBId, keywordIdB),
    ]);

    if (!dataA || !dataB) {
      return NextResponse.json({ error: "One or both scans not found" }, { status: 404 });
    }

    const cacheKey = compareCacheKey(
      scanBId,
      dataA.activeKeyword?.id ?? keywordIdA,
      dataB.activeKeyword?.id ?? keywordIdB,
      resolvedMode,
      entityAKey,
      entityBKey
    );
    const cached = await getWorkspaceCache<ComparePayload>(
      supabase,
      scanAId,
      WORKSPACE_CACHE_TYPES.COMPARE,
      cacheKey
    );
    if (cached) return NextResponse.json(cached);

    const payload = buildCompareArtifact(dataA, dataB, {
      entityAKey,
      entityBKey,
      mode,
    });

    void setWorkspaceCache(supabase, scanAId, WORKSPACE_CACHE_TYPES.COMPARE, cacheKey, payload);

    return NextResponse.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Compare failed";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
