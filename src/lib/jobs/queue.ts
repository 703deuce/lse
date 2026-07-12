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
    await supabase
      .from("job_queue")
      .update({ status: "running", started_at: new Date().toISOString(), attempts: job.attempts + 1 })
      .eq("id", job.id);

    try {
      if (job.job_type === "process_scan") {
        const payload = job.payload as { scanBatchId?: string; businessId?: string };
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
        .eq("id", job.id);
      processed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      const failed = job.attempts + 1 >= job.max_attempts;
      await supabase
        .from("job_queue")
        .update({
          status: failed ? "failed" : "pending",
          error_message: message,
          finished_at: failed ? new Date().toISOString() : null,
        })
        .eq("id", job.id);

      const payload = job.payload as { scanBatchId?: string };
      if (payload.scanBatchId) {
        await supabase
          .from("scan_batches")
          .update({ status: "failed", error_message: message })
          .eq("id", payload.scanBatchId);
      }
    }
  }

  const campaignSent = await processCampaignMessages(20);

  return { jobsProcessed: processed, campaignSent };
}
