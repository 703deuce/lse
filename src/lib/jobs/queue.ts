import { createServiceClient } from "@/lib/db/client";
import { processCampaignMessages } from "@/lib/reputation/campaign-processor";
import { processScanBatch } from "@/lib/jobs/process-scan";

export async function enqueueScanJob(scanBatchId: string, businessId?: string): Promise<void> {
  const supabase = createServiceClient();
  await supabase.from("job_queue").insert({
    job_type: "process_scan",
    payload: { scanBatchId, businessId },
    status: "pending",
  });
}

export async function processPendingJobs(limit = 5): Promise<{ jobsProcessed: number; campaignSent: number }> {
  const supabase = createServiceClient();
  const { data: jobs } = await supabase
    .from("job_queue")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(limit);

  if (!jobs?.length) {
    const campaignSent = await processCampaignMessages(20);
    return { jobsProcessed: 0, campaignSent };
  }

  let processed = 0;
  for (const job of jobs) {
    // Conditional claim — only one worker may take a pending job.
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
      await supabase
        .from("job_queue")
        .update({
          status: failed ? "failed" : "pending",
          error_message: message,
          finished_at: failed ? new Date().toISOString() : null,
        })
        .eq("id", claimed.id);

      const payload = claimed.payload as { scanBatchId?: string };
      if (payload.scanBatchId) {
        await supabase
          .from("scan_batches")
          .update({ status: "failed", error_message: message })
          .eq("id", payload.scanBatchId)
          .in("status", ["queued", "dispatching", "provider_running", "normalizing"]);
      }
    }
  }

  const campaignSent = await processCampaignMessages(20);

  return { jobsProcessed: processed, campaignSent };
}
