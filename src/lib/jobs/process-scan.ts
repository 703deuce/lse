import { createServiceClient } from "@/lib/db/client";
import { setBusinessGeom, setScanPointsGeom } from "@/lib/db/geo";
import { generateGrid } from "@/lib/maps/grid";
import { invalidateScanGridCache } from "@/lib/maps/scan-queries";
import {
  matchTargetInResults,
  extractTopCompetitors,
} from "@/lib/providers/dataforseo";
import { finalizeRankReady } from "@/lib/jobs/finalize-scan";
import { runGridCellsLive } from "@/lib/jobs/run-grid-cells";

export async function processScanBatch(scanBatchId: string, organizationId?: string): Promise<void> {
  const supabase = createServiceClient();

  // Atomic claim — only one worker processes a queued scan
  const { data: claimed } = await supabase
    .from("scan_batches")
    .update({ status: "dispatching", started_at: new Date().toISOString() })
    .eq("id", scanBatchId)
    .eq("status", "queued")
    .select("*")
    .maybeSingle();

  if (!claimed) {
    return; // Another request already claimed or finished this scan
  }

  const batch = claimed;

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", batch.business_id)
    .single();

  if (!business) throw new Error("Business not found");

  const { data: keywords } = await supabase
    .from("business_keywords")
    .select("*")
    .eq("business_id", business.id);

  let keywordList = keywords?.length ? keywords : [];
  if (!keywordList.length) throw new Error("No keywords configured");

  const confidence = (batch.confidence_summary ?? {}) as {
    keyword_ids?: string[];
  };
  if (confidence.keyword_ids?.length) {
    const allowed = new Set(confidence.keyword_ids);
    keywordList = keywordList.filter((k) => allowed.has(k.id as string));
    if (!keywordList.length) throw new Error("No matching keywords for this scan");
  }

  const centerLat =
    (batch.center_lat as number | null) ??
    business.scan_center_lat ??
    business.lat ??
    0;
  const centerLng =
    (batch.center_lng as number | null) ??
    business.scan_center_lng ??
    business.lng ??
    0;

  if (business.lat && business.lng) {
    try {
      await setBusinessGeom(business.id, business.lng, business.lat);
    } catch {
      /* PostGIS RPC optional until migration 002 */
    }
  }

  const grid = generateGrid({
    centerLat,
    centerLng,
    gridSize: batch.grid_size,
    radiusMeters: batch.radius_meters,
  });

  await supabase.from("scan_points").delete().eq("scan_batch_id", scanBatchId);
  invalidateScanGridCache(scanBatchId);

  const pointRows = grid.map((p) => ({
    scan_batch_id: scanBatchId,
    grid_label: p.label,
    lat: p.lat,
    lng: p.lng,
    distance_from_center_m: p.distanceFromCenterM,
  }));

  const { data: insertedPoints } = await supabase.from("scan_points").insert(pointRows).select("*");
  if (!insertedPoints?.length) throw new Error("Failed to create scan points");
  invalidateScanGridCache(scanBatchId);

  try {
    await setScanPointsGeom(
      insertedPoints.map((p) => ({ id: p.id, lng: p.lng as number, lat: p.lat as number }))
    );
  } catch {
    /* PostGIS RPC optional until migration 002 */
  }

  const totalTasks = insertedPoints.length * keywordList.length;

  console.log("[Scan] Starting batch (Bright Data live):", {
    scanBatchId,
    businessId: business.id,
    scanType: batch.scan_type,
    provider: "brightdata",
    gridSize: batch.grid_size,
    radiusMeters: batch.radius_meters,
    keywordCount: keywordList.length,
    cellCount: insertedPoints.length,
    totalTasks,
    center: { lat: centerLat, lng: centerLng },
  });

  await supabase
    .from("scan_batches")
    .update({ status: "provider_running", provider: "brightdata" })
    .eq("id", scanBatchId);

  let rankReadyFired = false;
  const totalCellsPlanned = insertedPoints.length * keywordList.length;

  const { failedCells, totalCells, successCells } = await runGridCellsLive({
    scanBatchId,
    points: insertedPoints.map((p) => ({
      id: p.id as string,
      grid_label: p.grid_label as string,
      lat: p.lat as number,
      lng: p.lng as number,
      distance_from_center_m: p.distance_from_center_m as number,
    })),
    keywords: keywordList.map((k) => ({
      id: k.id as string,
      keyword: String(k.keyword).trim(),
    })),
    business: {
      cid: business.cid,
      place_id: business.place_id,
      name: business.name,
      address_text: business.address_text,
      phone: business.phone,
      website_url: business.website_url,
    },
    device: batch.device ?? "mobile",
    os: batch.os ?? "android",
    browser: (batch as { browser?: string }).browser ?? "chrome",
    organizationId,
    onSoftReady: async () => {
      if (rankReadyFired) return;
      rankReadyFired = true;
      const { data: progress } = await supabase
        .from("scan_batches")
        .select("cells_failed")
        .eq("id", scanBatchId)
        .single();
      await finalizeRankReady(
        scanBatchId,
        organizationId,
        Number(progress?.cells_failed ?? 0),
        totalCellsPlanned
      );
    },
  });

  if (!rankReadyFired) {
    await finalizeRankReady(scanBatchId, organizationId, failedCells, totalCells);
  }
  console.log("[Scan] Live batch finished:", {
    scanBatchId,
    failedCells,
    totalCells,
    successCells,
  });
}

/** @deprecated Grid scans no longer use DataForSEO postback; kept for legacy webhook callbacks. */
export async function processProviderTaskResult(params: {
  tag: string;
  items: unknown[];
  checkUrl?: string;
  timestamp?: string;
  organizationId?: string;
}): Promise<void> {
  const supabase = createServiceClient();
  const parts = params.tag.split(":");
  if (parts.length < 3) return;

  const [scanBatchId, scanPointId, keywordId] = parts;

  const { data: batch } = await supabase.from("scan_batches").select("*").eq("id", scanBatchId).single();
  const { data: business } = batch
    ? await supabase.from("businesses").select("*").eq("id", batch.business_id).single()
    : { data: null };

  if (!business) return;

  const match = matchTargetInResults(params.items as Parameters<typeof matchTargetInResults>[0], {
    cid: business.cid,
    place_id: business.place_id,
    name: business.name,
    address: business.address_text,
    phone: business.phone,
    website_url: business.website_url,
  }, (params.items as unknown[]).length);

  await supabase.from("scan_results").insert({
    scan_point_id: scanPointId,
    keyword_id: keywordId,
    target_rank: match.rank,
    target_found: match.found,
    check_url: params.checkUrl,
    source_timestamp: params.timestamp,
    confidence: match.matchReason,
    top_competitors_json: extractTopCompetitors(params.items as Parameters<typeof extractTopCompetitors>[0]),
  });

  await supabase
    .from("scan_provider_tasks")
    .update({ status: "completed", result_json: { items: params.items } })
    .eq("tag", params.tag);

  const { data: pending } = await supabase
    .from("scan_provider_tasks")
    .select("id")
    .eq("scan_batch_id", scanBatchId)
    .eq("status", "pending");

  if ((pending ?? []).length === 0) {
    const { data: allTasks } = await supabase
      .from("scan_provider_tasks")
      .select("status")
      .eq("scan_batch_id", scanBatchId);
    const failed = (allTasks ?? []).filter((t) => t.status === "failed").length;
    const total = (allTasks ?? []).length;
    await finalizeRankReady(scanBatchId, params.organizationId, failed, total);
  }
}
