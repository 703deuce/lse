import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";
import { buildFingerprintArtifact } from "@/lib/maps/workspace-artifacts";
import { loadScanGridData } from "@/lib/maps/scan-queries";
import {
  WORKSPACE_CACHE_TYPES,
  fingerprintCacheKey,
  getWorkspaceCache,
  setWorkspaceCache,
} from "@/lib/maps/workspace-cache";
import {
  entityFromRawResult,
  type CompetitorFingerprint,
} from "@/lib/competitors/fingerprint";
import { entityKeyFromParts } from "@/lib/maps/grid-entity";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ competitorId: string }> }
) {
  try {
    const { competitorId } = await params;
    const url = new URL(request.url);
    const businessId = url.searchParams.get("businessId");
    const scanId = url.searchParams.get("scanId");
    const entityKey = url.searchParams.get("entityKey");
    const keywordId = url.searchParams.get("keywordId");

    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    if (!entityKey && competitorId === "temp") {
      return NextResponse.json({ error: "entityKey or valid competitorId required" }, { status: 400 });
    }

    await requireBusinessAccess(businessId);
    const supabase = createServiceClient();

    if (scanId) {
      const { data: owned } = await supabase
        .from("scan_batches")
        .select("id")
        .eq("id", scanId)
        .eq("business_id", businessId)
        .maybeSingle();
      if (!owned) {
        return NextResponse.json({ error: "Scan not found for this business" }, { status: 404 });
      }
    }

    const competitorIdResolved = competitorId === "temp" ? null : competitorId;

    let cacheEntityKey = entityKey;
    if (!cacheEntityKey && competitorIdResolved) {
      const { data: comp } = await supabase
        .from("competitors")
        .select("cid, place_id, name")
        .eq("id", competitorIdResolved)
        .maybeSingle();
      if (comp) cacheEntityKey = entityKeyFromParts(comp);
    }

    if (scanId && cacheEntityKey) {
      const gridData = await loadScanGridData(supabase, scanId, keywordId);
      const kwId = gridData?.activeKeyword?.id;
      if (kwId) {
        const cacheKey = fingerprintCacheKey(kwId, cacheEntityKey, competitorIdResolved);
        const cached = await getWorkspaceCache<CompetitorFingerprint>(
          supabase,
          scanId,
          WORKSPACE_CACHE_TYPES.FINGERPRINT,
          cacheKey
        );
        if (cached) return NextResponse.json(cached);
      }
    }

    if (!scanId) {
      return NextResponse.json({ error: "scanId required" }, { status: 400 });
    }

    const gridData = await loadScanGridData(supabase, scanId, keywordId);
    if (!gridData) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    }

    const fingerprint = await buildFingerprintArtifact(supabase, {
      gridData,
      entityKey: entityKey ?? "",
      competitorId: competitorIdResolved,
    });

    if (!fingerprint) {
      return NextResponse.json({ error: "Competitor not found" }, { status: 404 });
    }

    if (gridData.activeKeyword?.id) {
      const cacheKey = fingerprintCacheKey(
        gridData.activeKeyword.id,
        fingerprint.competitor.entityKey,
        competitorIdResolved
      );
      void setWorkspaceCache(
        supabase,
        scanId,
        WORKSPACE_CACHE_TYPES.FINGERPRINT,
        cacheKey,
        fingerprint
      );
    }

    return NextResponse.json(fingerprint);
  } catch (err) {
    return httpErrorFromException(err, "Fingerprint failed");
  }
}
