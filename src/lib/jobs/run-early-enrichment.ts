import pLimit from "p-limit";
import { createServiceClient } from "@/lib/db/client";
import { aggregateCompetitors } from "@/lib/maps/grid";
import { enrichTargetBusiness, enrichCompetitor } from "@/lib/jobs/enrich-competitors";
import { SCAN_RESULT_COMPETITOR_COLUMNS } from "@/lib/maps/scan-result-columns";
import { mergeScanConfidenceSummary } from "@/lib/jobs/merge-confidence-summary";

/** Start lightweight enrichment once enough rank cells exist — does not block the scan. */
export const EARLY_ENRICHMENT_MIN_CELLS = 17;
const EARLY_ENRICHMENT_CONCURRENCY = 2;

const inFlight = new Set<string>();

/**
 * Phase 2 (early) — enrich target + emerging top competitors after ~15–20 cells.
 * Rank scan keeps priority; this runs on a low-concurrency background queue.
 *
 * Claims via early_enrichment_started column (migration 032) so parallel workers
 * cannot double-start, and merges JSON flag without wiping progress keys.
 */
export async function maybeStartEarlyEnrichment(
  scanBatchId: string,
  organizationId?: string
): Promise<void> {
  if (inFlight.has(scanBatchId)) return;

  const supabase = createServiceClient();
  const { data: batch } = await supabase
    .from("scan_batches")
    .select("id, business_id, status, cells_completed, early_enrichment_started")
    .eq("id", scanBatchId)
    .maybeSingle();

  if (!batch) return;
  if (batch.status === "failed" || batch.status === "ready" || batch.status === "partial") return;
  if (batch.early_enrichment_started) return;

  const completed = Number(batch.cells_completed ?? 0);
  if (completed < EARLY_ENRICHMENT_MIN_CELLS) return;

  inFlight.add(scanBatchId);

  const { data: claimed } = await supabase
    .from("scan_batches")
    .update({ early_enrichment_started: true })
    .eq("id", scanBatchId)
    .eq("early_enrichment_started", false)
    .select("id")
    .maybeSingle();

  if (!claimed) {
    inFlight.delete(scanBatchId);
    return;
  }

  // Keep JSON flag in sync for older readers without overwriting sibling keys.
  try {
    await mergeScanConfidenceSummary(supabase, scanBatchId, {
      early_enrichment_started: true,
    });
  } catch (err) {
    console.warn("[maybeStartEarlyEnrichment] confidence merge skipped", scanBatchId, err);
  }

  try {
    let orgId = organizationId;
    if (!orgId && batch.business_id) {
      const { data: biz } = await supabase
        .from("businesses")
        .select("organization_id")
        .eq("id", batch.business_id)
        .maybeSingle();
      orgId = (biz?.organization_id as string | undefined) ?? undefined;
    }
    const { dispatchFeatureJob } = await import("@/lib/queue/dispatch");
    await dispatchFeatureJob({
      jobType: "early_enrichment",
      payload: {
        scanBatchId,
        organizationId: orgId,
        businessId: batch.business_id,
      },
      organizationId: orgId,
      businessId: batch.business_id as string,
      relatedResourceId: scanBatchId,
      idempotencyKey: `early-enrichment:${scanBatchId}`,
      priority: "lower",
      maxAttempts: 2,
    });
  } catch (err) {
    console.error("[earlyEnrichment] enqueue failed", scanBatchId, err);
    // Allow a later resume attempt if enqueue failed after claim.
    try {
      await supabase
        .from("scan_batches")
        .update({ early_enrichment_started: false })
        .eq("id", scanBatchId);
    } catch {
      /* ignore */
    }
  } finally {
    inFlight.delete(scanBatchId);
  }
}

/** Queue processor entry — also used for direct recovery. */
export async function processEarlyEnrichment(
  scanBatchId: string,
  organizationId?: string
): Promise<void> {
  return runEarlyEnrichment(scanBatchId, organizationId);
}

async function runEarlyEnrichment(scanBatchId: string, organizationId?: string): Promise<void> {
  const supabase = createServiceClient();

  const { data: batch } = await supabase
    .from("scan_batches")
    .select("id, business_id")
    .eq("id", scanBatchId)
    .maybeSingle();
  if (!batch) return;

  const { data: business } = await supabase.from("businesses").select("*").eq("id", batch.business_id).single();
  if (!business) return;

  const { data: keywords } = await supabase.from("business_keywords").select("*").eq("business_id", business.id);
  const primaryKeyword = keywords?.find((k) => k.is_primary) ?? keywords?.[0];
  if (!primaryKeyword) return;

  const { data: points } = await supabase
    .from("scan_points")
    .select("id")
    .eq("scan_batch_id", scanBatchId);
  const pointIds = (points ?? []).map((p) => p.id);
  const { data: results } = pointIds.length
    ? await supabase
        .from("scan_results")
        .select(SCAN_RESULT_COMPETITOR_COLUMNS)
        .in("scan_point_id", pointIds)
    : { data: [] };

  if (!(results ?? []).length) return;

  const lat = business.scan_center_lat ?? business.lat;
  const lng = business.scan_center_lng ?? business.lng;

  await enrichTargetBusiness({
    name: business.name,
    cid: business.cid,
    placeId: business.place_id,
    city: primaryKeyword.city,
    state: primaryKeyword.state,
    lat,
    lng,
    organizationId,
  });

  const topCompetitors = aggregateCompetitors(results ?? [], {
    excludeCid: business.cid,
    excludePlaceId: business.place_id,
    excludeName: business.name,
    targetCategory: business.primary_category,
    keyword: primaryKeyword.keyword,
  }).slice(0, 5);

  const limit = pLimit(EARLY_ENRICHMENT_CONCURRENCY);
  await Promise.all(
    topCompetitors.map((comp) =>
      limit(() =>
        enrichCompetitor({
          name: comp.name ?? "Unknown",
          cid: comp.cid,
          placeId: comp.place_id,
          lat,
          lng,
          city: primaryKeyword.city,
          state: primaryKeyword.state,
          seedRating: comp.rating,
          seedReviewCount: comp.review_count,
          organizationId,
        })
      )
    )
  );

  console.log("[EarlyEnrichment] warmed profiles for scan", scanBatchId, {
    competitors: topCompetitors.length,
  });
}
