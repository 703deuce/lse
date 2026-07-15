import { createServiceClient } from "@/lib/db/client";
import { processCampaignMessages } from "@/lib/reputation/campaign-processor";
import { processScanBatch } from "@/lib/jobs/process-scan";
import { reclaimStaleInFlightScans } from "@/lib/jobs/schedule-scan";
import { maybeRunDataRetentionCleanup } from "@/lib/jobs/retention";
import { logger } from "@/lib/observability/logger";
import { runContactImport, type ContactImportMode, type ContactImportRow } from "@/lib/reputation/contact-import";

const JOB_RUNNING_STALE_MS = Number(process.env.JOB_RUNNING_STALE_MS ?? 20 * 60 * 1000);

export async function enqueueScanJob(scanBatchId: string, businessId?: string): Promise<void> {
  const supabase = createServiceClient();
  await supabase.from("job_queue").insert({
    job_type: "process_scan",
    payload: { scanBatchId, businessId },
    status: "pending",
  });
}

export async function enqueueImportContactsJob(payload: {
  uploadId: string;
  businessId: string;
  organizationId: string;
  mode: ContactImportMode;
}): Promise<void> {
  const supabase = createServiceClient();
  await supabase.from("job_queue").insert({
    job_type: "import_contacts",
    payload,
    status: "pending",
  });
}

function retryDelayMs(attempt: number): number {
  const base = Math.min(60_000, 1000 * 2 ** Math.max(0, attempt - 1));
  const jitter = Math.floor(Math.random() * 1000);
  return base + jitter;
}

/** Requeue jobs stuck in `running` after a worker crash / deploys. */
async function reclaimStaleRunningJobs(
  supabase: ReturnType<typeof createServiceClient>
): Promise<number> {
  const staleBefore = new Date(Date.now() - JOB_RUNNING_STALE_MS).toISOString();
  const { data } = await supabase
    .from("job_queue")
    .update({
      status: "pending",
      scheduled_at: new Date().toISOString(),
      error_message: "Reclaimed stale running job",
    })
    .eq("status", "running")
    .lt("started_at", staleBefore)
    .select("id");

  const count = data?.length ?? 0;
  if (count > 0) {
    logger.warn("job_queue_stale_running_reclaimed", { count, staleBefore });
  }
  return count;
}

export async function processPendingJobs(limit = 5): Promise<{
  jobsProcessed: number;
  campaignSent: number;
  scansReclaimed: number;
  jobsReclaimed: number;
  retention: Awaited<ReturnType<typeof maybeRunDataRetentionCleanup>>;
}> {
  const supabase = createServiceClient();

  const retention = await maybeRunDataRetentionCleanup();
  const jobsReclaimed = await reclaimStaleRunningJobs(supabase);
  const scansReclaimed = await reclaimStaleInFlightScans(5);

  const { data: jobs } = await supabase
    .from("job_queue")
    .select("id, job_type, payload, attempts, max_attempts, status, scheduled_at")
    .eq("status", "pending")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(limit);

  if (!jobs?.length) {
    const campaignSent = await processCampaignMessages(20);
    return { jobsProcessed: 0, campaignSent, scansReclaimed, jobsReclaimed, retention };
  }

  let processed = 0;
  for (const job of jobs) {
    const { data: claimed } = await supabase
      .from("job_queue")
      .update({
        status: "running",
        started_at: new Date().toISOString(),
        attempts: (job.attempts ?? 0) + 1,
      })
      .eq("id", job.id)
      .eq("status", "pending")
      .select("id, job_type, payload, attempts, max_attempts")
      .maybeSingle();

    if (!claimed) {
      continue;
    }

    try {
      if (claimed.job_type === "process_scan") {
        const payload = claimed.payload as { scanBatchId?: string; businessId?: string };
        if (payload.scanBatchId) {
          let orgId: string | undefined;
          if (payload.businessId) {
            const { data: biz } = await supabase
              .from("businesses")
              .select("organization_id")
              .eq("id", payload.businessId)
              .maybeSingle();
            orgId = biz?.organization_id;
          }
          if (!orgId) {
            const { data: batch } = await supabase
              .from("scan_batches")
              .select("business_id")
              .eq("id", payload.scanBatchId)
              .maybeSingle();
            if (batch) {
              const { data: biz } = await supabase
                .from("businesses")
                .select("organization_id")
                .eq("id", batch.business_id)
                .maybeSingle();
              orgId = biz?.organization_id;
            }
          }
          await processScanBatch(payload.scanBatchId, orgId);
        }
      } else if (claimed.job_type === "import_contacts") {
        const payload = claimed.payload as {
          uploadId?: string;
          businessId?: string;
          organizationId?: string;
          mode?: ContactImportMode;
        };
        if (!payload.uploadId || !payload.businessId || !payload.organizationId) {
          throw new Error("import_contacts payload incomplete");
        }
        const { data: upload } = await supabase
          .from("review_request_uploads")
          .update({ status: "running", started_at: new Date().toISOString() })
          .eq("id", payload.uploadId)
          .in("status", ["queued", "running"])
          .select("rows_json, mode")
          .maybeSingle();
        if (!upload) throw new Error("Import upload not found or already finished");
        const rows = (upload.rows_json ?? []) as ContactImportRow[];
        await runContactImport({
          organizationId: payload.organizationId,
          businessId: payload.businessId,
          uploadId: payload.uploadId,
          mode: payload.mode ?? (upload.mode as ContactImportMode) ?? "update",
          rows,
        });
      }

      await supabase
        .from("job_queue")
        .update({ status: "completed", finished_at: new Date().toISOString() })
        .eq("id", claimed.id);
      processed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      const attempts = claimed.attempts ?? (job.attempts ?? 0) + 1;
      const maxAttempts = claimed.max_attempts ?? job.max_attempts ?? 3;
      const failed = attempts >= maxAttempts;
      const delay = retryDelayMs(attempts);

      await supabase
        .from("job_queue")
        .update({
          status: failed ? "failed" : "pending",
          error_message: message,
          finished_at: failed ? new Date().toISOString() : null,
          scheduled_at: failed ? undefined : new Date(Date.now() + delay).toISOString(),
        })
        .eq("id", claimed.id);

      const payload = claimed.payload as { scanBatchId?: string };
      if (payload.scanBatchId && failed) {
        await supabase
          .from("scan_batches")
          .update({
            status: "failed",
            error_message: message,
            finished_at: new Date().toISOString(),
            lease_owner: null,
            lease_expires_at: null,
          })
          .eq("id", payload.scanBatchId)
          .in("status", ["queued", "dispatching", "provider_running", "normalizing"]);
      }
      logger.error("job_queue_processing_failed", {
        jobId: claimed.id,
        jobType: claimed.job_type,
        attempts,
        failed,
        error: message,
      });
    }
  }

  const campaignSent = await processCampaignMessages(20);

  return { jobsProcessed: processed, campaignSent, scansReclaimed, jobsReclaimed, retention };
}
