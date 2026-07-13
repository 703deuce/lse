import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/db/client";
import { requireScanAccess } from "@/lib/auth/api-auth";
import { kickQueuedScanIfNeeded } from "@/lib/jobs/schedule-scan";
import { isMapRenderable } from "@/lib/scans/status";
import { dedupeScanResults } from "@/lib/maps/cell-result-integrity";
import { SCAN_RESULT_GRID_COLUMNS } from "@/lib/maps/scan-result-columns";
import type { ScanResultRow } from "@/lib/db/types";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ scanId: string }> }
) {
  try {
    const { scanId } = await params;
    const url = new URL(request.url);
    const keywordId = url.searchParams.get("keywordId");
    const access = await requireScanAccess(scanId);
    const supabase = createServiceClient();

    const { data: batch } = await supabase.from("scan_batches").select("*").eq("id", scanId).single();
    if (!batch) return NextResponse.json({ error: "Scan not found" }, { status: 404 });

    const { data: business } = await supabase
      .from("businesses")
      .select("name, cid, place_id, lat, lng, scan_center_lat, scan_center_lng, address_text, primary_category, phone, website_url")
      .eq("id", batch.business_id)
      .single();

    const { data: allKeywords } = await supabase
      .from("business_keywords")
      .select("*")
      .eq("business_id", batch.business_id);

    const conf = (batch.confidence_summary ?? {}) as {
      keyword_ids?: string[];
      keyword_label?: string;
    };
    const scanKeywordId = Array.isArray(conf.keyword_ids) ? conf.keyword_ids[0] : undefined;

    const activeKeyword =
      (keywordId ? allKeywords?.find((k) => k.id === keywordId) : null) ??
      (scanKeywordId ? allKeywords?.find((k) => k.id === scanKeywordId) : null) ??
      allKeywords?.find((k) => k.is_primary) ??
      allKeywords?.[0];

    // Recover scans stuck in queued (e.g. if background worker didn't start)
    kickQueuedScanIfNeeded(scanId, batch.status, access.organizationId);

    const { data: points } = await supabase.from("scan_points").select("*").eq("scan_batch_id", scanId);
    const pointIds = (points ?? []).map((p) => p.id);
    let results: unknown[] = [];
    if (pointIds.length) {
      let query = supabase
        .from("scan_results")
        .select(SCAN_RESULT_GRID_COLUMNS)
        .in("scan_point_id", pointIds);
      if (activeKeyword?.id) {
        query = query.eq("keyword_id", activeKeyword.id);
      }
      const { data } = await query;
      results = dedupeScanResults((data ?? []) as unknown as ScanResultRow[]);
    }

    const { data: priorBatch } = await supabase
      .from("scan_batches")
      .select("aggregate_metrics")
      .eq("business_id", batch.business_id)
      .in("status", ["ready", "partial", "rank_ready"])
      .neq("id", scanId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      batch: {
        ...batch,
        map_renderable: isMapRenderable(batch.status),
      },
      business: business ?? null,
      primaryKeyword: activeKeyword?.keyword ?? null,
      primaryKeywordId: activeKeyword?.id ?? null,
      scanKeywordId: scanKeywordId ?? activeKeyword?.id ?? null,
      primaryKeywordCity: activeKeyword?.city ?? null,
      primaryKeywordState: activeKeyword?.state ?? null,
      keywords: allKeywords ?? [],
      points: points ?? [],
      results,
      priorMetrics: priorBatch?.aggregate_metrics ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Status fetch failed";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
