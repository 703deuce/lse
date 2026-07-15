import { createServiceClient } from "@/lib/db/client";
import { gridMapCredits, releaseUsage } from "@/lib/plans";

/** Pre-provider / cancel failures that should refund map credits when no cells ran. */
export const PRE_PROVIDER_FAIL =
  /No keywords|No matching keywords|Scan center is missing|Business not found|Failed to create scan points|No grid points left after exclusions|Canceled by operator/i;

/**
 * Refund map credits when the scan never produced provider results.
 * Safe under BullMQ workers (database `after()` path also uses this).
 */
export async function maybeReleaseUnusedMapCredits(
  scanBatchId: string,
  organizationId: string,
  reason?: string
): Promise<boolean> {
  if (reason && !PRE_PROVIDER_FAIL.test(reason) && reason !== "force") {
    // Only auto-refund known pre-provider / cancel cases unless forced.
    return false;
  }

  const supabase = createServiceClient();
  const { data: batch } = await supabase
    .from("scan_batches")
    .select("grid_size")
    .eq("id", scanBatchId)
    .maybeSingle();
  if (!batch?.grid_size) return false;

  const { data: points } = await supabase
    .from("scan_points")
    .select("id")
    .eq("scan_batch_id", scanBatchId);
  const pointIds = (points ?? []).map((p) => p.id);

  let resultCount = 0;
  if (pointIds.length) {
    const { count } = await supabase
      .from("scan_results")
      .select("id", { count: "exact", head: true })
      .in("scan_point_id", pointIds);
    resultCount = count ?? 0;
  }

  // Only refund when no provider cells produced results.
  if (resultCount > 0) return false;

  await releaseUsage(
    organizationId,
    "map_credits_used",
    gridMapCredits(Number(batch.grid_size))
  );
  return true;
}
