import { createServiceClient } from "@/lib/db/client";
import { processScanBatch } from "@/lib/jobs/process-scan";
import {
  runContactImport,
  type ContactImportMode,
  type ContactImportRow,
} from "@/lib/reputation/contact-import";
import type { QueueName } from "@/lib/queue/types";
import { logger } from "@/lib/observability/logger";

export type QueueJobPayload = {
  ledgerJobId?: string;
  jobId?: string;
  scanBatchId?: string;
  businessId?: string;
  organizationId?: string;
  uploadId?: string;
  mode?: string;
  [key: string]: unknown;
};

/**
 * Shared processors for BullMQ workers.
 * Database-driver jobs still run via processPendingJobs (cron) + Next.js after().
 */
export async function processQueueJob(
  queueName: QueueName,
  payload: QueueJobPayload
): Promise<void> {
  const supabase = createServiceClient();
  const ledgerJobId =
    (typeof payload.ledgerJobId === "string" && payload.ledgerJobId) ||
    (typeof payload.jobId === "string" && payload.jobId) ||
    null;

  if (ledgerJobId) {
    const { data: claimed } = await supabase
      .from("job_queue")
      .update({
        status: "running",
        started_at: new Date().toISOString(),
        heartbeat_at: new Date().toISOString(),
      })
      .eq("id", ledgerJobId)
      .in("status", ["pending", "running"])
      .select("id, attempts, max_attempts, job_type")
      .maybeSingle();

    // Another worker may own it mid-flight; still run handlers that are idempotent
    // if we were handed this BullMQ delivery (Maps lease + import claim guard).
    if (!claimed) {
      const { data: row } = await supabase
        .from("job_queue")
        .select("status")
        .eq("id", ledgerJobId)
        .maybeSingle();
      if (row?.status === "completed" || row?.status === "failed") {
        logger.info("queue_processor_skip_terminal", { ledgerJobId, status: row.status, queueName });
        return;
      }
    } else {
      await supabase
        .from("job_queue")
        .update({ attempts: (claimed.attempts ?? 0) + 1 })
        .eq("id", ledgerJobId);
    }
  }

  try {
    if (queueName === "maps-scan" || queueName === "maps-cell-retry") {
      const scanBatchId = String(payload.scanBatchId ?? "");
      if (!scanBatchId) throw permanentError("Missing scanBatchId");
      let orgId =
        typeof payload.organizationId === "string" ? payload.organizationId : undefined;
      if (!orgId && typeof payload.businessId === "string") {
        const { data: biz } = await supabase
          .from("businesses")
          .select("organization_id")
          .eq("id", payload.businessId)
          .maybeSingle();
        orgId = biz?.organization_id as string | undefined;
      }
      const ran = await processScanBatch(scanBatchId, orgId);
      if (ledgerJobId) {
        if (ran) {
          await markLedgerTerminal(ledgerJobId, "completed");
        } else {
          // Lease owned elsewhere or already finished — resolve ledger from scan state.
          const { data: batch } = await supabase
            .from("scan_batches")
            .select("status")
            .eq("id", scanBatchId)
            .maybeSingle();
          const st = batch?.status as string | undefined;
          if (st === "completed" || st === "failed" || st === "rank_ready") {
            await markLedgerTerminal(
              ledgerJobId,
              st === "failed" ? "failed" : "completed"
            );
          }
          // else leave running/pending for the owning worker / recovery
        }
      }
      return;
    }

    if (queueName === "review-import") {
      const uploadId = String(payload.uploadId ?? "");
      const businessId = String(payload.businessId ?? "");
      const organizationId = String(payload.organizationId ?? "");
      if (!uploadId || !businessId || !organizationId) {
        throw permanentError("import_contacts payload incomplete");
      }
      const { data: upload } = await supabase
        .from("review_request_uploads")
        .update({ status: "running", started_at: new Date().toISOString() })
        .eq("id", uploadId)
        .in("status", ["queued", "running"])
        .select("rows_json, mode")
        .maybeSingle();
      if (!upload) throw permanentError("Import upload not found or already finished");
      const rows = (upload.rows_json ?? []) as ContactImportRow[];
      await runContactImport({
        organizationId,
        businessId,
        uploadId,
        mode:
          (payload.mode as ContactImportMode) ??
          (upload.mode as ContactImportMode) ??
          "update",
        rows,
      });
      if (ledgerJobId) await markLedgerTerminal(ledgerJobId, "completed");
      return;
    }

    // Queues registered for future processors — do not silently succeed.
    throw permanentError(`No processor registered for queue ${queueName}`);
  } catch (err) {
    if (ledgerJobId) {
      const message = err instanceof Error ? err.message : "Job failed";
      const permanent = isPermanentError(err);
      await supabase
        .from("job_queue")
        .update({
          status: permanent ? "failed" : "pending",
          error_message: message,
          error_code: permanent ? "unrecoverable" : "retryable",
          finished_at: permanent ? new Date().toISOString() : null,
          enqueue_state: "enqueued",
        })
        .eq("id", ledgerJobId);
    }
    throw err;
  }
}

async function markLedgerTerminal(
  ledgerJobId: string,
  status: "completed" | "failed"
): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from("job_queue")
    .update({
      status,
      finished_at: new Date().toISOString(),
      heartbeat_at: new Date().toISOString(),
    })
    .eq("id", ledgerJobId);
}

function permanentError(message: string): Error {
  const err = new Error(message);
  (err as Error & { unrecoverable?: boolean }).unrecoverable = true;
  return err;
}

export function isPermanentError(err: unknown): boolean {
  return Boolean(err instanceof Error && (err as Error & { unrecoverable?: boolean }).unrecoverable);
}
