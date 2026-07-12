import { createServiceClient } from "@/lib/db/client";
import { setBusinessGeom, setScanPointsGeom } from "@/lib/db/geo";
import { generateGrid } from "@/lib/maps/grid";
import { invalidateScanGridCache } from "@/lib/maps/scan-queries";
import {
  matchTargetInResults,
  extractTopCompetitors,
  taskPostMaps,
} from "@/lib/providers/dataforseo";
import { finalizeRankReady } from "@/lib/jobs/finalize-scan";
import { runGridCellsLive } from "@/lib/jobs/run-grid-cells";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function postbackUrlUsable(): boolean {
  try {
    const host = new URL(APP_URL).hostname;
    return host !== "localhost" && host !== "127.0.0.1" && !host.endsWith(".local");
  } catch {
    return false;
  }
}

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

  const confidence = (batch.confidence_summary ?? {}) as { keyword_ids?: string[] };
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
  const useStandard =
    (batch.scan_type === "standard" || totalTasks > 25) && postbackUrlUsable();

  console.log("[Scan] Starting batch:", {
    scanBatchId,
    businessId: business.id,
    scanType: batch.scan_type,
    useStandard,
    postbackUsable: postbackUrlUsable(),
    gridSize: batch.grid_size,
    radiusMeters: batch.radius_meters,
    keywordCount: keywordList.length,
    cellCount: insertedPoints.length,
    totalTasks,
    center: { lat: centerLat, lng: centerLng },
  });

  if (useStandard) {
    await dispatchStandardScan({
      scanBatchId,
      batch,
      business,
      points: insertedPoints,
      keywords: keywordList,
      organizationId,
    });
    return;
  }

  await supabase.from("scan_batches").update({ status: "provider_running" }).eq("id", scanBatchId);

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

async function dispatchStandardScan(params: {
  scanBatchId: string;
  batch: Record<string, unknown>;
  business: Record<string, unknown>;
  points: Array<Record<string, unknown>>;
  keywords: Array<Record<string, unknown>>;
  organizationId?: string;
}) {
  const supabase = createServiceClient();
  await supabase.from("scan_batches").update({ status: "provider_running" }).eq("id", params.scanBatchId);

  const postbackUrl = `${APP_URL}/api/webhooks/dataforseo`;
  const tasks: Array<{ keyword: string; lat: number; lng: number; postbackUrl?: string; tag?: string }> = [];
  const pendingRows: Array<{
    scan_batch_id: string;
    scan_point_id: string;
    keyword_id: string;
    tag: string;
    status: string;
  }> = [];

  for (const keyword of params.keywords) {
    for (const point of params.points) {
      const tag = `${params.scanBatchId}:${point.id}:${keyword.id}`;
      tasks.push({
        keyword: String(keyword.keyword).trim(),
        lat: point.lat as number,
        lng: point.lng as number,
        postbackUrl,
        tag,
      });
      pendingRows.push({
        scan_batch_id: params.scanBatchId,
        scan_point_id: point.id as string,
        keyword_id: keyword.id as string,
        tag,
        status: "pending",
      });
    }
  }

  console.log("[Scan] Dispatching standard scan:", {
    scanBatchId: params.scanBatchId,
    taskCount: tasks.length,
    postbackUrl,
  });

  await supabase.from("scan_provider_tasks").insert(pendingRows);

  const batchSize = 100;
  for (let i = 0; i < tasks.length; i += batchSize) {
    const chunk = tasks.slice(i, i + batchSize);
    const taskIds = await taskPostMaps({ tasks: chunk, organizationId: params.organizationId });
    for (let j = 0; j < taskIds.length; j++) {
      const tag = chunk[j]?.tag;
      if (!tag) continue;
      await supabase
        .from("scan_provider_tasks")
        .update({ external_task_id: taskIds[j] })
        .eq("tag", tag);
    }
  }
}

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
