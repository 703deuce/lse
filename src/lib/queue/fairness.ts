import { createServiceClient } from "@/lib/db/client";
import {
  maxActiveMapsScansPerOrg,
  maxQueuedMapsScansPerOrg,
} from "@/lib/queue/config";
import { getOrganizationPlan } from "@/lib/plans";
import { resolveFreelancerLimits } from "@/lib/plans/resolve-freelancer-limits";

const ACTIVE_SCAN_STATUSES = [
  "queued",
  "dispatching",
  "provider_running",
  "normalizing",
  "enriching",
  "recovering",
  "rank_ready",
] as const;

export type MapsFairnessResult =
  | { ok: true }
  | { ok: false; reason: string; code: "active_limit" | "queued_limit" | "duplicate" };

/** Enforce per-org Maps concurrency before accepting another scan. */
export async function assertCanEnqueueMapsScan(params: {
  organizationId: string;
  businessId: string;
  scanBatchId: string;
  keyword?: string | null;
  gridSize?: number | null;
}): Promise<MapsFairnessResult> {
  const supabase = createServiceClient();

  const { count: activeCount } = await supabase
    .from("scan_batches")
    .select("id", { count: "exact", head: true })
    .eq("business_id", params.businessId)
    .in("status", [...ACTIVE_SCAN_STATUSES])
    .neq("id", params.scanBatchId);

  // Soft check: one business shouldn't stack many actives (org limit below).
  if ((activeCount ?? 0) >= 1) {
    // Allow queueing more for the org, but surface duplicate-like pressure.
  }

  const { data: orgBusinesses } = await supabase
    .from("businesses")
    .select("id")
    .eq("organization_id", params.organizationId);
  const businessIds = (orgBusinesses ?? []).map((b) => b.id as string);
  if (!businessIds.length) return { ok: true };

  const plan = await getOrganizationPlan(params.organizationId).catch(() => null);
  const freelancerLimits = resolveFreelancerLimits(plan?.id);
  const concurrentCap = Math.min(
    maxActiveMapsScansPerOrg(),
    freelancerLimits.maxConcurrentScans
  );

  if (params.gridSize != null && params.gridSize > freelancerLimits.maxGridSize) {
    return {
      ok: false,
      code: "active_limit",
      reason: `Grid size ${params.gridSize}×${params.gridSize} exceeds your plan maximum of ${freelancerLimits.maxGridSize}×${freelancerLimits.maxGridSize}.`,
    };
  }

  const { count: orgActive } = await supabase
    .from("scan_batches")
    .select("id", { count: "exact", head: true })
    .in("business_id", businessIds)
    .in("status", [
      "dispatching",
      "provider_running",
      "normalizing",
      "enriching",
      "recovering",
    ])
    .neq("id", params.scanBatchId);

  if ((orgActive ?? 0) >= concurrentCap) {
    return {
      ok: false,
      code: "active_limit",
      reason: `You already have ${orgActive} scan(s) running (limit ${concurrentCap} concurrent). Wait for one to finish, then try again.`,
    };
  }

  const { count: orgQueued } = await supabase
    .from("scan_batches")
    .select("id", { count: "exact", head: true })
    .in("business_id", businessIds)
    .eq("status", "queued")
    .neq("id", params.scanBatchId);

  if ((orgQueued ?? 0) >= maxQueuedMapsScansPerOrg()) {
    return {
      ok: false,
      code: "queued_limit",
      reason: `Organization already has ${orgQueued} queued Maps scans (limit ${maxQueuedMapsScansPerOrg()}).`,
    };
  }

  return { ok: true };
}

/** Find an already-running equivalent scan for dedupe. */
export async function findDuplicateActiveScan(params: {
  businessId: string;
  keywordLabel?: string | null;
  gridSize?: number | null;
  radiusMeters?: number | null;
  excludeScanId?: string | null;
}): Promise<{ id: string; status: string } | null> {
  if (!params.keywordLabel || !params.gridSize) return null;
  const supabase = createServiceClient();
  let query = supabase
    .from("scan_batches")
    .select("id, status, grid_size, radius_meters, confidence_summary")
    .eq("business_id", params.businessId)
    .eq("grid_size", params.gridSize)
    .in("status", [...ACTIVE_SCAN_STATUSES])
    .order("created_at", { ascending: false })
    .limit(10);

  if (params.radiusMeters) query = query.eq("radius_meters", params.radiusMeters);
  if (params.excludeScanId) query = query.neq("id", params.excludeScanId);

  const { data } = await query;
  const needle = params.keywordLabel.trim().toLowerCase();
  for (const row of data ?? []) {
    const conf = (row.confidence_summary ?? {}) as { keyword_label?: string };
    const label = conf.keyword_label?.trim().toLowerCase() ?? "";
    if (label && label === needle) {
      return { id: row.id as string, status: String(row.status) };
    }
  }
  return null;
}
