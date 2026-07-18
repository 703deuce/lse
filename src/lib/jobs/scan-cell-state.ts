import { createServiceClient } from "@/lib/db/client";
import { LOCAL_FALCON_PARITY } from "@/lib/maps/local-falcon-parity";
import { validateStoredCellResult } from "@/lib/maps/cell-result-integrity";

function cellIntegrityDepth(): number {
  const n = Number(
    process.env.BRIGHTDATA_MAPS_DEPTH ??
      process.env.SCRAPINGDOG_MAPS_DEPTH ??
      LOCAL_FALCON_PARITY.gridDepth
  );
  return Number.isFinite(n) && n > 0 ? Math.min(n, 100) : LOCAL_FALCON_PARITY.gridDepth;
}

export type ScanCellStatus =
  | "pending"
  | "running"
  | "retry_wait"
  | "complete"
  | "failed_permanent";

const STALE_RUNNING_MS = 2 * 60_000;

/** Reset cells stuck in `running` after a worker crash so recovery can retry them. */
export async function resetStaleRunningCells(scanBatchId: string): Promise<number> {
  const supabase = createServiceClient();
  const staleBefore = new Date(Date.now() - STALE_RUNNING_MS).toISOString();
  const { data, error } = await supabase
    .from("scan_points")
    .update({
      cell_status: "retry_wait",
      updated_at: new Date().toISOString(),
    })
    .eq("scan_batch_id", scanBatchId)
    .eq("cell_status", "running")
    .lt("last_attempt_at", staleBefore)
    .select("id");

  if (error) {
    console.warn(`[Scan] resetStaleRunningCells failed scan=${scanBatchId}:`, error.message);
    return 0;
  }
  const count = data?.length ?? 0;
  if (count > 0) {
    console.log(`[Scan] scan=${scanBatchId} reset stale running cells count=${count}`);
  }
  return count;
}

export async function markCellAttemptStarted(scanPointId: string): Promise<void> {
  const supabase = createServiceClient();
  const now = new Date().toISOString();
  const { data: existing } = await supabase
    .from("scan_points")
    .select("first_attempt_at, total_attempts")
    .eq("id", scanPointId)
    .maybeSingle();
  await supabase
    .from("scan_points")
    .update({
      cell_status: "running",
      last_attempt_at: now,
      first_attempt_at: (existing?.first_attempt_at as string | null) ?? now,
      total_attempts: Number(existing?.total_attempts ?? 0) + 1,
      updated_at: now,
    })
    .eq("id", scanPointId)
    .neq("cell_status", "complete");
}

export async function markCellComplete(scanPointId: string): Promise<void> {
  const supabase = createServiceClient();
  const now = new Date().toISOString();
  await supabase
    .from("scan_points")
    .update({
      cell_status: "complete",
      completed_at: now,
      last_error_category: null,
      last_error_message: null,
      next_retry_at: null,
      updated_at: now,
    })
    .eq("id", scanPointId);
}

export async function markCellRetryWait(
  scanPointId: string,
  opts: {
    category: string | null;
    message: string | null;
    capacityFailure?: boolean;
  }
): Promise<void> {
  const supabase = createServiceClient();
  const now = new Date().toISOString();
  const { data: existing } = await supabase
    .from("scan_points")
    .select("capacity_failures, actual_search_failures, cell_status")
    .eq("id", scanPointId)
    .maybeSingle();
  if (existing?.cell_status === "complete") return;

  const capacity = opts.capacityFailure === true;
  await supabase
    .from("scan_points")
    .update({
      cell_status: "retry_wait",
      last_error_category: opts.category,
      last_error_message: opts.message,
      capacity_failures: Number(existing?.capacity_failures ?? 0) + (capacity ? 1 : 0),
      actual_search_failures:
        Number(existing?.actual_search_failures ?? 0) + (capacity ? 0 : 1),
      next_retry_at: now,
      updated_at: now,
    })
    .eq("id", scanPointId)
    .neq("cell_status", "complete");
}

export type UnresolvedCellCount = {
  totalCells: number;
  completedCells: number;
  unresolvedCells: number;
  progressPercent: number;
};

/** Count complete vs unresolved cells from DB (source of truth). */
export async function countScanCellProgress(scanBatchId: string): Promise<UnresolvedCellCount> {
  const supabase = createServiceClient();
  const depth = cellIntegrityDepth();

  const { data: points } = await supabase
    .from("scan_points")
    .select("id")
    .eq("scan_batch_id", scanBatchId);
  const pointIds = (points ?? []).map((p) => p.id as string);
  const totalCells = pointIds.length;
  if (!totalCells) {
    return { totalCells: 0, completedCells: 0, unresolvedCells: 0, progressPercent: 0 };
  }

  const { data: results } = await supabase
    .from("scan_results")
    .select("scan_point_id, keyword_id, target_found, top_competitors_json")
    .in("scan_point_id", pointIds);

  const complete = new Set<string>();
  for (const row of results ?? []) {
    if (validateStoredCellResult(row, depth).complete) {
      complete.add(row.scan_point_id as string);
    }
  }

  const completedCells = complete.size;
  const unresolvedCells = Math.max(0, totalCells - completedCells);
  const progressPercent =
    totalCells > 0 ? Math.min(100, Math.round((completedCells / totalCells) * 100)) : 0;

  return { totalCells, completedCells, unresolvedCells, progressPercent };
}

/** Persist parent progress without decreasing completed/progress. */
export async function persistScanProgress(scanBatchId: string): Promise<UnresolvedCellCount> {
  const supabase = createServiceClient();
  const progress = await countScanCellProgress(scanBatchId);
  const { data: existing } = await supabase
    .from("scan_batches")
    .select("cells_completed, cells_total, confidence_summary")
    .eq("id", scanBatchId)
    .maybeSingle();

  const prevCompleted = Number(existing?.cells_completed ?? 0);
  const safeCompleted = Math.max(prevCompleted, progress.completedCells);
  const safeTotal = Math.max(Number(existing?.cells_total ?? 0), progress.totalCells);
  const safeUnresolved = Math.max(0, safeTotal - safeCompleted);
  const safePercent =
    safeTotal > 0 ? Math.min(100, Math.round((safeCompleted / safeTotal) * 100)) : 0;

  await supabase
    .from("scan_batches")
    .update({
      cells_total: safeTotal,
      cells_completed: safeCompleted,
      cells_failed: 0,
      updated_at: new Date().toISOString(),
    })
    .eq("id", scanBatchId);

  const { mergeScanConfidenceSummary } = await import("@/lib/jobs/merge-confidence-summary");
  await mergeScanConfidenceSummary(supabase, scanBatchId, {
    completed_cells: safeCompleted,
    total_cells: safeTotal,
    unresolved_cells: safeUnresolved,
    progress_percent: safePercent,
    failed_cells: 0,
  }).catch(() => undefined);

  return {
    totalCells: safeTotal,
    completedCells: safeCompleted,
    unresolvedCells: safeUnresolved,
    progressPercent: safePercent,
  };
}
