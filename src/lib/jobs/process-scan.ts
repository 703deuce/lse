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
import {
  claimQueuedScan,
  clearScanLease,
  extendScanLease,
  newScanLeaseOwner,
  reclaimStaleScan,
  scanLeaseTtlMs,
} from "@/lib/jobs/scan-lease";

/**
 * Process or resume a scan batch.
 * - Fresh: claims `queued` → creates points → runs all cells.
 * - Resume: reclaims stale `dispatching`/`provider_running` → keeps points → skips complete cells.
 */
export async function processScanBatch(scanBatchId: string, organizationId?: string): Promise<void> {
  const supabase = createServiceClient();
  const leaseOwner = newScanLeaseOwner();

  let batch = await claimQueuedScan(scanBatchId, leaseOwner);
  let resume = false;

  if (!batch) {
    batch = await reclaimStaleScan(scanBatchId, leaseOwner);
    resume = !!batch;
  }

  if (!batch) {
    return; // Another worker owns the lease, or scan already finished
  }

  const heartbeatMs = Math.max(15_000, Math.floor(scanLeaseTtlMs() / 3));
  const heartbeat = setInterval(() => {
    void extendScanLease(scanBatchId, leaseOwner).then((ok) => {
      if (!ok) {
        console.warn(`[Scan] Lost lease on ${scanBatchId}; heartbeat stopped`);
      }
    });
  }, heartbeatMs);

  try {
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
      null;
    const centerLng =
      (batch.center_lng as number | null) ??
      business.scan_center_lng ??
      business.lng ??
      null;

    if (
      centerLat == null ||
      centerLng == null ||
      !Number.isFinite(Number(centerLat)) ||
      !Number.isFinite(Number(centerLng)) ||
      (Number(centerLat) === 0 && Number(centerLng) === 0)
    ) {
      throw new Error("Scan center is missing. Set a scan center on the business before running a grid.");
    }

    if (business.lat && business.lng) {
      try {
        await setBusinessGeom(business.id, business.lng, business.lat);
      } catch {
        /* PostGIS RPC optional until migration 002 */
      }
    }

    type PointRow = {
      id: string;
      grid_label: string;
      lat: number;
      lng: number;
      distance_from_center_m: number | null;
    };

    let insertedPoints: PointRow[] | null = null;

    if (resume) {
      const { data: existingPoints } = await supabase
        .from("scan_points")
        .select("id, grid_label, lat, lng, distance_from_center_m")
        .eq("scan_batch_id", scanBatchId);
      if (existingPoints?.length) {
        insertedPoints = existingPoints as PointRow[];
        console.log("[Scan] Resuming stale batch with existing points:", {
          scanBatchId,
          pointCount: existingPoints.length,
          leaseOwner,
        });
      } else {
        // Crash before points were inserted — fall through to fresh grid create.
        resume = false;
      }
    }

    if (!insertedPoints) {
      const grid = generateGrid({
        centerLat,
        centerLng,
        gridSize: batch.grid_size as number,
        radiusMeters: batch.radius_meters as number,
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

      const { data: created } = await supabase.from("scan_points").insert(pointRows).select("*");
      if (!created?.length) throw new Error("Failed to create scan points");
      invalidateScanGridCache(scanBatchId);
      insertedPoints = created as PointRow[];

      try {
        await setScanPointsGeom(
          insertedPoints.map((p) => ({ id: p.id, lng: p.lng, lat: p.lat }))
        );
      } catch {
        /* PostGIS RPC optional until migration 002 */
      }
    }

    const totalTasks = insertedPoints.length * keywordList.length;

    console.log("[Scan] Starting batch (Bright Data live):", {
      scanBatchId,
      resume,
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
      .update({
        status: "provider_running",
        provider: "brightdata",
        lease_owner: leaseOwner,
        lease_expires_at: new Date(Date.now() + scanLeaseTtlMs()).toISOString(),
        heartbeat_at: new Date().toISOString(),
      })
      .eq("id", scanBatchId)
      .eq("lease_owner", leaseOwner);

    let rankReadyPromise: Promise<void> | null = null;
    const totalCellsPlanned = insertedPoints.length * keywordList.length;

    const { failedCells, totalCells, successCells } = await runGridCellsLive({
      scanBatchId,
      resume,
      points: insertedPoints.map((p) => ({
        id: p.id,
        grid_label: p.grid_label,
        lat: p.lat,
        lng: p.lng,
        distance_from_center_m: p.distance_from_center_m ?? undefined,
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
      device: (batch.device as string | null) ?? "mobile",
      os: (batch.os as string | null) ?? "android",
      browser: (batch as { browser?: string }).browser ?? "chrome",
      organizationId,
      onLeaseHeartbeat: async () => {
        await extendScanLease(scanBatchId, leaseOwner);
      },
      onSoftReady: async () => {
        if (!rankReadyPromise) {
          rankReadyPromise = (async () => {
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
          })();
        }
        await rankReadyPromise;
      },
    });

    if (!rankReadyPromise) {
      await finalizeRankReady(scanBatchId, organizationId, failedCells, totalCells);
    } else {
      await rankReadyPromise;
    }

    await clearScanLease(scanBatchId, leaseOwner);

    console.log("[Scan] Live batch finished:", {
      scanBatchId,
      resume,
      failedCells,
      totalCells,
      successCells,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Processing failed";
    await supabase
      .from("scan_batches")
      .update({
        status: "failed",
        error_message: message,
        finished_at: new Date().toISOString(),
        lease_owner: null,
        lease_expires_at: null,
      })
      .eq("id", scanBatchId)
      .eq("lease_owner", leaseOwner)
      .in("status", ["queued", "dispatching", "provider_running", "normalizing"]);
    throw err;
  } finally {
    clearInterval(heartbeat);
  }
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
