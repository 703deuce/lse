import { createServiceClient } from "@/lib/db/client";
import { cancelJob } from "@/lib/queue/service";
import { maybeReleaseUnusedMapCredits } from "@/lib/jobs/map-credits";

const CANCELLABLE_SCAN_STATUSES = [
  "queued",
  "dispatching",
  "provider_running",
  "normalizing",
  "enriching",
  "recovering",
] as const;

export function isCancellableScanStatus(status: string | null | undefined): boolean {
  return Boolean(status && (CANCELLABLE_SCAN_STATUSES as readonly string[]).includes(status));
}

/**
 * Cancel a Maps scan the caller already authorized.
 * Marks the batch failed, cancels related queue jobs, refunds unused credits.
 */
export async function cancelScanBatch(params: {
  scanBatchId: string;
  organizationId: string;
  reason?: string;
}): Promise<{ ok: true; cancelledJobs: number } | { ok: false; reason: string }> {
  const supabase = createServiceClient();
  const reason = params.reason?.trim() || "Canceled by user";
  const finishedAt = new Date().toISOString();

  const { data: batch } = await supabase
    .from("scan_batches")
    .select("id, status")
    .eq("id", params.scanBatchId)
    .maybeSingle();

  if (!batch) return { ok: false, reason: "Scan not found" };
  if (!isCancellableScanStatus(String(batch.status))) {
    return { ok: false, reason: `Scan is already ${String(batch.status)}` };
  }

  const { data: updated } = await supabase
    .from("scan_batches")
    .update({
      status: "failed",
      error_message: reason,
      finished_at: finishedAt,
      lease_owner: null,
      lease_expires_at: null,
      heartbeat_at: null,
    })
    .eq("id", params.scanBatchId)
    .in("status", [...CANCELLABLE_SCAN_STATUSES])
    .select("id")
    .maybeSingle();

  if (!updated) {
    return { ok: false, reason: "Scan could not be cancelled (status changed)" };
  }

  // Cancel related ledger/BullMQ jobs (process_scan + cell retries).
  const { data: jobs } = await supabase
    .from("job_queue")
    .select("id, status, job_type, payload")
    .in("job_type", ["process_scan", "retry_scan_cells"])
    .in("status", ["pending", "running", "retrying"])
    .order("created_at", { ascending: false })
    .limit(40);

  let cancelledJobs = 0;
  for (const job of jobs ?? []) {
    const payload = (job.payload ?? {}) as { scanBatchId?: string };
    if (payload.scanBatchId !== params.scanBatchId) continue;
    const ok = await cancelJob(String(job.id)).catch(() => false);
    if (ok) cancelledJobs += 1;
  }

  await maybeReleaseUnusedMapCredits(
    params.scanBatchId,
    params.organizationId,
    reason
  ).catch(() => {});

  return { ok: true, cancelledJobs };
}

/** Cancel every cancellable scan across an organization. */
export async function cancelAllOrgScans(params: {
  organizationId: string;
  reason?: string;
}): Promise<{ cancelledScans: number; cancelledJobs: number }> {
  const supabase = createServiceClient();
  const { data: businesses } = await supabase
    .from("businesses")
    .select("id")
    .eq("organization_id", params.organizationId);
  const businessIds = (businesses ?? []).map((b) => b.id as string);
  if (!businessIds.length) return { cancelledScans: 0, cancelledJobs: 0 };

  const { data: scans } = await supabase
    .from("scan_batches")
    .select("id")
    .in("business_id", businessIds)
    .in("status", [...CANCELLABLE_SCAN_STATUSES])
    .order("created_at", { ascending: false })
    .limit(100);

  let cancelledScans = 0;
  let cancelledJobs = 0;
  for (const scan of scans ?? []) {
    const result = await cancelScanBatch({
      scanBatchId: String(scan.id),
      organizationId: params.organizationId,
      reason: params.reason ?? "Canceled by user",
    });
    if (result.ok) {
      cancelledScans += 1;
      cancelledJobs += result.cancelledJobs;
    }
  }
  return { cancelledScans, cancelledJobs };
}
