import { after } from "next/server";
import { createServiceClient } from "@/lib/db/client";
import { processScanBatch } from "@/lib/jobs/process-scan";

/** Run scan processing after the HTTP response — reliable in Next.js dev/server. */
export function scheduleScanProcessing(scanBatchId: string, organizationId?: string): void {
  after(async () => {
    try {
      await processScanBatch(scanBatchId, organizationId);
    } catch (err) {
      console.error(`[Scan] Batch ${scanBatchId} failed:`, err instanceof Error ? err.message : err);
      if (err instanceof Error && err.stack) console.error("[Scan] Stack:", err.stack);
      const supabase = createServiceClient();
      await supabase
        .from("scan_batches")
        .update({
          status: "failed",
          error_message: err instanceof Error ? err.message : "Processing failed",
          finished_at: new Date().toISOString(),
        })
        .eq("id", scanBatchId);
    }
  });
}

/** If scan is still queued, schedule processing (safe to call on every poll — atomic claim inside processScanBatch). */
export function kickQueuedScanIfNeeded(scanBatchId: string, status: string, organizationId?: string): void {
  if (status !== "queued") return;
  scheduleScanProcessing(scanBatchId, organizationId);
}
