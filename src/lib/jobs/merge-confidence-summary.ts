import { createServiceClient } from "@/lib/db/client";

type ServiceClient = ReturnType<typeof createServiceClient>;

/**
 * Merge keys into scan_batches.confidence_summary without wiping sibling keys.
 * Requires migration 032 (merge_scan_confidence_summary).
 */
export async function mergeScanConfidenceSummary(
  supabase: ServiceClient,
  scanBatchId: string,
  patch: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase.rpc("merge_scan_confidence_summary", {
    p_scan_id: scanBatchId,
    p_patch: patch,
  });
  if (error) throw new Error(error.message);
}
