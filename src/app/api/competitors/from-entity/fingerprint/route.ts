import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";
import {
  buildCompetitorFingerprint,
  entityFromRawResult,
  findRawInResults,
} from "@/lib/competitors/fingerprint";
import { entityFromKey } from "@/lib/maps/grid-entity";
import { loadScanGridData } from "@/lib/maps/scan-queries";
import type { ScanPointRow, ScanResultRow } from "@/lib/db/types";
import type { StoredCompetitor } from "@/lib/maps/grid-entity";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      businessId: string;
      scanId?: string;
      entityKey: string;
      rawResult?: StoredCompetitor;
      keywordId?: string;
    };

    await requireBusinessAccess(body.businessId);
    const supabase = createServiceClient();

    let entity = entityFromKey(body.entityKey, body.entityKey);
    let raw = body.rawResult;
    if (raw) entity = entityFromRawResult(raw);

    let points: ScanPointRow[] = [];
    let results: ScanResultRow[] = [];
    let centerLat = 0;
    let centerLng = 0;
    let keyword: string | null = null;

    if (body.scanId) {
      const gridData = await loadScanGridData(supabase, body.scanId, body.keywordId);
      if (gridData) {
        points = gridData.points as ScanPointRow[];
        results = gridData.results as ScanResultRow[];
        centerLat = gridData.batch.center_lat ?? points[0]?.lat ?? 0;
        centerLng = gridData.batch.center_lng ?? points[0]?.lng ?? 0;
        keyword = gridData.activeKeyword
          ? String(gridData.activeKeyword.keyword).trim()
          : null;
        if (!raw) raw = findRawInResults(results, entity) ?? undefined;
      }
    }

    const fingerprint = buildCompetitorFingerprint({
      entity,
      raw: raw ?? null,
      competitorId: null,
      points,
      results,
      centerLat,
      centerLng,
      keyword,
    });

    return NextResponse.json(fingerprint);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Fingerprint failed";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
