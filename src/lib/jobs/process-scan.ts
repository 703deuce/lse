import { createServiceClient } from "@/lib/db/client";
import { setBusinessGeom, setScanPointsGeom } from "@/lib/db/geo";
import { generateGrid } from "@/lib/maps/grid";
import { invalidateScanGridCache } from "@/lib/maps/scan-queries";
import {
  matchTargetInResults,
  extractTopCompetitors,
} from "@/lib/providers/dataforseo";
import { finalizeRankReady } from "@/lib/jobs/finalize-scan";
import { mergeScanConfidenceSummary } from "@/lib/jobs/merge-confidence-summary";
import { runGridCellsLive } from "@/lib/jobs/run-grid-cells";
import {
  claimQueuedScan,
  clearScanLease,
  extendScanLease,
  newScanLeaseOwner,
  reclaimStaleScan,
  releaseClaimToQueued,
  scanLeaseTtlMs,
} from "@/lib/jobs/scan-lease";
import { assertOrgMapsScanSlotAvailable } from "@/lib/queue/fairness";
import { CELLS_IN_FLIGHT_STATUSES } from "@/lib/scans/status";
import {
  mapsProviderModeLabel,
  parseMapsProviderMode,
  scanBatchProviderColumn,
} from "@/lib/maps/provider-modes";
import { persistScanProgress, resetStaleRunningCells } from "@/lib/jobs/scan-cell-state";

/** Outcome of attempting to process a scan batch. */
export type ProcessScanOutcome = "ran" | "deferred" | "already_done";

export type ProcessScanOptions = {
  /** True when invoked from delayed maps-cell-retry recovery. */
  recoveryMode?: boolean;
  recoveryGeneration?: number;
};

/** Usable / post-cell statuses — job can complete without re-running the grid. */
const SCAN_ALREADY_DONE = new Set([
  "ready",
  "partial",
  "failed",
  "enriching",
  "scoring",
  "ai_planning",
]);
// Note: `normalizing` is intentionally NOT here — finalize may still be writing.
// `rank_ready` is handled separately: only already_done when pass=complete.
// `recovering` is handled via reclaim / recovery jobs — never already_done here.

/**
 * Process or resume a scan batch.
 * - Fresh: claims `queued` → creates points → runs all cells.
 * - Resume: reclaims stale `dispatching`/`provider_running`/`recovering` → keeps points → skips complete cells.
 *
 * @returns `ran` when this invocation owned the lease,
 * `already_done` when the scan is past map-cell work,
 * `deferred` when another worker holds the lease.
 */
export async function processScanBatch(
  scanBatchId: string,
  organizationId?: string,
  options?: ProcessScanOptions
): Promise<ProcessScanOutcome> {
  const supabase = createServiceClient();
  const leaseOwner = newScanLeaseOwner();
  const recoveryMode = options?.recoveryMode === true;

  let batch = recoveryMode ? null : await claimQueuedScan(scanBatchId, leaseOwner);
  let resume = false;

  if (!batch) {
    batch = await reclaimStaleScan(scanBatchId, leaseOwner);
    resume = !!batch;
  }

  if (!batch) {
    const { data: current } = await supabase
      .from("scan_batches")
      .select("status, confidence_summary")
      .eq("id", scanBatchId)
      .maybeSingle();
    const status = String(current?.status ?? "");
    if (SCAN_ALREADY_DONE.has(status)) return "already_done";
    if (status === "rank_ready") {
      const pass = String(
        ((current?.confidence_summary as { pass?: unknown } | null)?.pass ?? "") as string
      );
      // Soft-ready with unfinished retries must not ACK the ledger as complete.
      if (pass === "complete" || !pass) return "already_done";
      return "deferred";
    }
    // Stuck normalizing: attempt finalize resume rather than defer forever.
    if (status === "normalizing") {
      try {
        const { finalizeRankReady } = await import("@/lib/jobs/finalize-scan");
        await finalizeRankReady(scanBatchId, organizationId);
        const { data: after } = await supabase
          .from("scan_batches")
          .select("status, confidence_summary")
          .eq("id", scanBatchId)
          .maybeSingle();
        const afterStatus = String(after?.status ?? "");
        // Do not ACK the ledger complete while cells/finalize are still in flight.
        if (CELLS_IN_FLIGHT_STATUSES.has(afterStatus)) return "deferred";
        if (afterStatus === "recovering") return "deferred";
        if (afterStatus === "rank_ready") {
          const pass = String(
            ((after?.confidence_summary as { pass?: unknown } | null)?.pass ?? "") as string
          );
          if (pass && pass !== "complete") return "deferred";
        }
        return "already_done";
      } catch {
        return "deferred";
      }
    }
    // recovering with an active lease held by another worker
    if (status === "recovering") return "deferred";
    return "deferred";
  }

  // Serial-per-org: after claiming, yield if another scan for this account is
  // already running. Oldest-started wins so simultaneous claims do not deadlock.
  if (!resume && !recoveryMode) {
    const { data: bizRow } = await supabase
      .from("businesses")
      .select("organization_id")
      .eq("id", batch.business_id)
      .maybeSingle();
    const orgForSlot =
      organizationId ||
      (typeof bizRow?.organization_id === "string" ? bizRow.organization_id : null);
    if (orgForSlot) {
      const slot = await assertOrgMapsScanSlotAvailable({
        organizationId: orgForSlot,
        scanBatchId,
        businessId: String(batch.business_id),
      });
      if (!slot.ok) {
        await releaseClaimToQueued(scanBatchId, leaseOwner);
        const { JobDeferredError } = await import("@/lib/queue/errors");
        console.log(
          `[Scan] Deferred ${scanBatchId} — org already has a running scan (serial per account)`
        );
        // Longer delay so we do not thrash while the active scan runs.
        throw new JobDeferredError(slot.reason, 30_000);
      }
    }
  }

  await resetStaleRunningCells(scanBatchId);

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

    // Cost ledger + plan credits require org — fall back from business when job payload omitted it.
    const resolvedOrgId =
      organizationId ||
      (typeof business.organization_id === "string" ? business.organization_id : undefined);

    const { data: keywords } = await supabase
      .from("business_keywords")
      .select("*")
      .eq("business_id", business.id);

    let keywordList = keywords?.length ? keywords : [];
    if (!keywordList.length) throw new Error("No keywords configured");

    const confidence = (batch.confidence_summary ?? {}) as {
      keyword_ids?: string[];
      excluded_labels?: string[];
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
      const excluded = new Set(
        (confidence.excluded_labels ?? []).map((l) => String(l).trim().toUpperCase())
      );

      const grid = generateGrid({
        centerLat,
        centerLng,
        gridSize: batch.grid_size as number,
        radiusMeters: batch.radius_meters as number,
      }).filter((p) => !excluded.has(p.label.toUpperCase()));

      if (!grid.length) throw new Error("No grid points left after exclusions");

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
    const confSummary = (batch.confidence_summary ?? {}) as Record<string, unknown>;
    const providerMode = parseMapsProviderMode(confSummary.maps_provider_mode);

    console.log("[Scan] Starting batch:", {
      scanBatchId,
      resume,
      businessId: business.id,
      scanType: batch.scan_type,
      providerMode,
      providerModeLabel: mapsProviderModeLabel(providerMode),
      provider: scanBatchProviderColumn(providerMode),
      gridSize: batch.grid_size,
      radiusMeters: batch.radius_meters,
      keywordCount: keywordList.length,
      cellCount: insertedPoints.length,
      totalTasks,
      center: { lat: centerLat, lng: centerLng },
      device: batch.device,
      os: batch.os,
    });

    const runStatus = recoveryMode ? "recovering" : "provider_running";
    await supabase
      .from("scan_batches")
      .update({
        status: runStatus,
        provider: scanBatchProviderColumn(providerMode),
        lease_owner: leaseOwner,
        lease_expires_at: new Date(Date.now() + scanLeaseTtlMs()).toISOString(),
        heartbeat_at: new Date().toISOString(),
      })
      .eq("id", scanBatchId)
      .eq("lease_owner", leaseOwner);

    await mergeScanConfidenceSummary(supabase, scanBatchId, {
      maps_provider_mode: providerMode,
    }).catch(() => undefined);

    console.log(
      `[Scan] scan=${scanBatchId} ${recoveryMode ? "recovery-window" : "active-window"} START ` +
        `total=${insertedPoints.length * keywordList.length}`
    );

    let rankReadyPromise: Promise<void> | null = null;
    const totalCellsPlanned = insertedPoints.length * keywordList.length;

    const { failedCells, totalCells, successCells, needsBackgroundRecovery } =
      await runGridCellsLive({
        scanBatchId,
        resume: resume || recoveryMode,
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
        providerMode,
        organizationId: resolvedOrgId,
        onLeaseHeartbeat: async () => {
          await extendScanLease(scanBatchId, leaseOwner);
        },
        // Never soft-finalize mid-scan when persistent recovery is enabled for hybrid.
        onSoftReady: async () => {
          if (providerMode === "hybrid") return;
          if (!rankReadyPromise) {
            rankReadyPromise = (async () => {
              const { data: progress } = await supabase
                .from("scan_batches")
                .select("cells_failed")
                .eq("id", scanBatchId)
                .single();
              await finalizeRankReady(
                scanBatchId,
                resolvedOrgId,
                Number(progress?.cells_failed ?? 0),
                totalCellsPlanned
              );
            })();
          }
          await rankReadyPromise;
        },
      });

    const progress = await persistScanProgress(scanBatchId);
    const unresolved =
      progress.unresolvedCells > 0
        ? progress.unresolvedCells
        : needsBackgroundRecovery
          ? failedCells
          : 0;

    if (unresolved > 0 && (providerMode === "hybrid" || recoveryMode)) {
      // Keep completed cells; schedule delayed recovery — do not finalize incomplete.
      if (!resolvedOrgId) {
        throw new Error("Missing organizationId for background scan recovery");
      }
      const { transitionToBackgroundRecovery } = await import("@/lib/jobs/scan-recovery");
      await transitionToBackgroundRecovery({
        scanBatchId,
        businessId: business.id as string,
        organizationId: resolvedOrgId,
        leaseOwner,
        completedCells: progress.completedCells || successCells,
        unresolvedCells: unresolved,
        totalCells: progress.totalCells || totalCells,
      });
      console.log("[Scan] Live batch deferred to background recovery:", {
        scanBatchId,
        resume,
        recoveryMode,
        unresolved,
        completed: progress.completedCells || successCells,
        totalCells,
      });
      return "ran";
    }

    if (!rankReadyPromise) {
      await finalizeRankReady(scanBatchId, resolvedOrgId, failedCells, totalCells);
    } else {
      await rankReadyPromise;
    }
    // Reconcile only after a complete finalize path.
    const { reconcileScanCellFailures } = await import("@/lib/jobs/reconcile-scan-failures");
    await reconcileScanCellFailures(scanBatchId, failedCells, totalCells);

    await clearScanLease(scanBatchId, leaseOwner);

    console.log("[Scan] Live batch finished:", {
      scanBatchId,
      resume,
      failedCells,
      totalCells,
      successCells,
    });
    return "ran";
  } catch (err) {
    const message = err instanceof Error ? err.message : "Processing failed";
    // Permanent configuration / crash errors only — never mark failed for provider capacity.
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
      .in("status", ["queued", "dispatching", "provider_running", "recovering", "normalizing"]);
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
