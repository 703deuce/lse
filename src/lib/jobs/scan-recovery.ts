import { createServiceClient } from "@/lib/db/client";
import { finalizeRankReady } from "@/lib/jobs/finalize-scan";
import {
  countScanCellProgress,
  persistScanProgress,
  resetStaleRunningCells,
} from "@/lib/jobs/scan-cell-state";
import { clearScanLease, newScanLeaseOwner } from "@/lib/jobs/scan-lease";
import { enqueueJob } from "@/lib/queue";
import { logger } from "@/lib/observability/logger";
import type { ProcessScanOutcome } from "@/lib/jobs/process-scan";

const TERMINAL_DONE = new Set(["ready", "partial", "failed", "cancelled"]);
const MAX_SCAN_RECOVERY_AGE_MS = 24 * 60 * 60 * 1000;
const RECOVERY_LEASE_MS = 12 * 60 * 1000;

export function getBackgroundRecoveryDelay(generation: number): number {
  const delays = [
    5 * 60_000,
    5 * 60_000,
    10 * 60_000,
    10 * 60_000,
    15 * 60_000,
  ];
  const idx = Math.max(0, Math.min(generation - 1, delays.length - 1));
  return delays[idx];
}

export function mapsRecoveryIdempotencyKey(
  scanBatchId: string,
  recoveryGeneration: number
): string {
  return `maps-recovery:${scanBatchId}:generation:${recoveryGeneration}`;
}

/** Atomic recovery lease so only one recovery worker processes a scan. */
export async function acquireRecoveryLease(params: {
  scanBatchId: string;
  workerId: string;
  leaseMs?: number;
}): Promise<boolean> {
  const supabase = createServiceClient();
  const leaseMs = params.leaseMs ?? RECOVERY_LEASE_MS;
  const now = new Date();
  const nowIso = now.toISOString();
  const expires = new Date(now.getTime() + leaseMs).toISOString();

  const { data: unlocked } = await supabase
    .from("scan_batches")
    .update({
      recovery_locked_at: nowIso,
      recovery_lock_owner: params.workerId,
      recovery_lease_expires_at: expires,
      updated_at: nowIso,
    })
    .eq("id", params.scanBatchId)
    .in("status", ["provider_running", "recovering", "dispatching", "normalizing"])
    .or(`recovery_lease_expires_at.is.null,recovery_lease_expires_at.lt.${nowIso}`)
    .select("id")
    .maybeSingle();

  if (unlocked) return true;

  const { data: sameOwner } = await supabase
    .from("scan_batches")
    .update({
      recovery_locked_at: nowIso,
      recovery_lease_expires_at: expires,
      updated_at: nowIso,
    })
    .eq("id", params.scanBatchId)
    .eq("recovery_lock_owner", params.workerId)
    .select("id")
    .maybeSingle();

  return !!sameOwner;
}

export async function releaseRecoveryLease(
  scanBatchId: string,
  workerId: string
): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from("scan_batches")
    .update({
      recovery_locked_at: null,
      recovery_lock_owner: null,
      recovery_lease_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", scanBatchId)
    .eq("recovery_lock_owner", workerId);
}

export async function scheduleScanRecoveryJob(params: {
  scanBatchId: string;
  businessId: string;
  organizationId: string;
  recoveryGeneration: number;
  delayMs?: number;
}): Promise<{ jobId: string; delayMs: number; reused: boolean }> {
  const delayMs =
    params.delayMs ?? getBackgroundRecoveryDelay(params.recoveryGeneration);
  const nextAt = new Date(Date.now() + delayMs).toISOString();
  const supabase = createServiceClient();

  await supabase
    .from("scan_batches")
    .update({
      status: "recovering",
      recovery_generation: params.recoveryGeneration,
      next_recovery_at: nextAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.scanBatchId)
    .in("status", ["provider_running", "dispatching", "recovering", "normalizing"]);

  const idempotencyKey = mapsRecoveryIdempotencyKey(
    params.scanBatchId,
    params.recoveryGeneration
  );

  const result = await enqueueJob({
    queueName: "maps-cell-retry",
    jobType: "retry_scan_cells",
    payload: {
      scanBatchId: params.scanBatchId,
      businessId: params.businessId,
      organizationId: params.organizationId,
      recoveryGeneration: params.recoveryGeneration,
    },
    organizationId: params.organizationId,
    businessId: params.businessId,
    relatedResourceId: params.scanBatchId,
    idempotencyKey,
    priority: "highest",
    delayMs,
    maxAttempts: 3,
  });

  console.log(
    `[Recovery] scan=${params.scanBatchId} scheduled generation=${params.recoveryGeneration} delay=${Math.round(delayMs / 1000)}s job=${result.jobId} reused=${result.reused}`
  );

  return { jobId: result.jobId, delayMs, reused: result.reused };
}

/**
 * After an active Bright Data window ends with unresolved cells:
 * mark recovering, clear worker lease, schedule delayed recovery.
 */
export async function transitionToBackgroundRecovery(params: {
  scanBatchId: string;
  businessId: string;
  organizationId: string;
  leaseOwner?: string;
  completedCells: number;
  unresolvedCells: number;
  totalCells: number;
}): Promise<void> {
  const supabase = createServiceClient();
  const { data: batch } = await supabase
    .from("scan_batches")
    .select("recovery_generation, started_at, created_at")
    .eq("id", params.scanBatchId)
    .maybeSingle();

  const nextGeneration = Math.max(1, Number(batch?.recovery_generation ?? 0) + 1);
  const startedAt = new Date(
    String(batch?.started_at ?? batch?.created_at ?? Date.now())
  ).getTime();

  await persistScanProgress(params.scanBatchId);
  console.log(
    `[Scan] scan=${params.scanBatchId} active-window EXPIRED completed=${params.completedCells} unresolved=${params.unresolvedCells}`
  );

  if (params.leaseOwner) {
    await clearScanLease(params.scanBatchId, params.leaseOwner);
  }

  if (Number.isFinite(startedAt) && Date.now() - startedAt > MAX_SCAN_RECOVERY_AGE_MS) {
    console.warn(
      `[Recovery] scan=${params.scanBatchId} age exceeded 24h — not scheduling further recovery (unresolved=${params.unresolvedCells})`
    );
    await supabase
      .from("scan_batches")
      .update({
        status: "recovering",
        cells_completed: params.completedCells,
        cells_total: params.totalCells,
        cells_failed: 0,
        next_recovery_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.scanBatchId);
    return;
  }

  await scheduleScanRecoveryJob({
    scanBatchId: params.scanBatchId,
    businessId: params.businessId,
    organizationId: params.organizationId,
    recoveryGeneration: nextGeneration,
  });
}

/**
 * Delayed recovery worker entrypoint (maps-cell-retry / retry_scan_cells).
 */
export async function processScanRecovery(
  scanBatchId: string,
  organizationId?: string,
  recoveryGeneration?: number
): Promise<ProcessScanOutcome> {
  const supabase = createServiceClient();
  const workerId = newScanLeaseOwner();

  const { data: scan } = await supabase
    .from("scan_batches")
    .select("id, status, business_id, recovery_generation, confidence_summary")
    .eq("id", scanBatchId)
    .maybeSingle();

  if (!scan) return "already_done";
  const status = String(scan.status);
  if (TERMINAL_DONE.has(status)) return "already_done";
  if (status === "rank_ready") {
    const pass = String(
      ((scan.confidence_summary as { pass?: unknown } | null)?.pass ?? "") as string
    );
    if (!pass || pass === "complete") return "already_done";
  }

  await resetStaleRunningCells(scanBatchId);
  let progress = await countScanCellProgress(scanBatchId);
  if (progress.unresolvedCells === 0 && progress.totalCells > 0) {
    console.log(`[Finalization] scan=${scanBatchId} START (recovery precheck)`);
    await finalizeRankReady(scanBatchId, organizationId, 0, progress.totalCells);
    return "ran";
  }

  const acquired = await acquireRecoveryLease({
    scanBatchId,
    workerId,
    leaseMs: RECOVERY_LEASE_MS,
  });
  if (!acquired) {
    console.log(`[Recovery] scan=${scanBatchId} lease not acquired — defer`);
    return "deferred";
  }

  const generation =
    recoveryGeneration ?? Math.max(1, Number(scan.recovery_generation ?? 1));

  try {
    await supabase
      .from("scan_batches")
      .update({
        status: "recovering",
        last_recovery_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", scanBatchId);

    console.log(
      `[Recovery] scan=${scanBatchId} generation=${generation} START unresolved=${progress.unresolvedCells}`
    );

    const { processScanBatch } = await import("@/lib/jobs/process-scan");
    const outcome = await processScanBatch(scanBatchId, organizationId, {
      recoveryMode: true,
      recoveryGeneration: generation,
    });

    progress = await persistScanProgress(scanBatchId);
    console.log(
      `[Recovery] scan=${scanBatchId} generation=${generation} FINISHED completed=${progress.completedCells} unresolved=${progress.unresolvedCells}`
    );
    return outcome;
  } finally {
    await releaseRecoveryLease(scanBatchId, workerId);
  }
}

/** Periodic maintenance: find stuck active scans and enqueue recovery/finalize. */
export async function reconcileIncompleteMapsScans(limit = 10): Promise<number> {
  const supabase = createServiceClient();
  const staleBefore = new Date(Date.now() - 10 * 60_000).toISOString();

  const { data: rows } = await supabase
    .from("scan_batches")
    .select(
      "id, status, business_id, recovery_generation, recovery_lease_expires_at, updated_at"
    )
    .in("status", ["queued", "dispatching", "provider_running", "recovering", "normalizing"])
    .lt("updated_at", staleBefore)
    .order("updated_at", { ascending: true })
    .limit(limit);

  let fixed = 0;
  for (const row of rows ?? []) {
    const scanBatchId = row.id as string;
    await resetStaleRunningCells(scanBatchId);

    const leaseExp = row.recovery_lease_expires_at
      ? new Date(String(row.recovery_lease_expires_at)).getTime()
      : 0;
    if (leaseExp && leaseExp < Date.now()) {
      await supabase
        .from("scan_batches")
        .update({
          recovery_locked_at: null,
          recovery_lock_owner: null,
          recovery_lease_expires_at: null,
        })
        .eq("id", scanBatchId);
    }

    const progress = await countScanCellProgress(scanBatchId);
    const { data: biz } = await supabase
      .from("businesses")
      .select("organization_id")
      .eq("id", row.business_id as string)
      .maybeSingle();
    const organizationId = biz?.organization_id as string | undefined;
    const businessId = row.business_id as string;
    if (!organizationId || !businessId) continue;

    if (progress.totalCells > 0 && progress.unresolvedCells === 0) {
      await finalizeRankReady(scanBatchId, organizationId, 0, progress.totalCells);
      fixed++;
      continue;
    }

    if (progress.unresolvedCells > 0) {
      if (row.status === "queued" || row.status === "dispatching") {
        const { enqueueMapsScanJob } = await import("@/lib/queue");
        await enqueueMapsScanJob({
          scanBatchId,
          businessId,
          organizationId,
          priority: "highest",
        }).catch(() => null);
      } else {
        const generation = Math.max(1, Number(row.recovery_generation ?? 0) + 1);
        await scheduleScanRecoveryJob({
          scanBatchId,
          businessId,
          organizationId,
          recoveryGeneration: generation,
          delayMs: 5_000,
        }).catch((err) => {
          logger.warn("maps_reconcile_recovery_enqueue_failed", {
            scanBatchId,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      }
      fixed++;
    }
  }

  if (fixed > 0) {
    logger.info("maps_incomplete_scans_reconciled", { fixed });
  }
  return fixed;
}
