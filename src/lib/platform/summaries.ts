import { createServiceClient } from "@/lib/db/client";
import { getCache, tenantCacheKey } from "@/lib/cache";
import { logger } from "@/lib/observability/logger";

export type FeatureSummaryName =
  | "maps"
  | "local_trust"
  | "backlink_gap"
  | "ai_visibility"
  | "citations"
  | "reputation"
  | "review_momentum"
  | "growth_audit"
  | "reviews_campaign";

const CACHE_TTL_MS = 60_000;

export async function getFeatureSummary(params: {
  organizationId: string;
  businessId: string;
  feature: FeatureSummaryName;
}): Promise<{ summary: Record<string, unknown>; version: number } | null> {
  const cache = getCache();
  const key = tenantCacheKey(params.organizationId, "summary", params.feature, params.businessId);
  const cached = await cache.get<{ summary: Record<string, unknown>; version: number }>(key);
  if (cached) return cached;

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("feature_business_summaries")
    .select("summary_json, version")
    .eq("business_id", params.businessId)
    .eq("feature", params.feature)
    .maybeSingle();
  if (!data) return null;
  const value = {
    summary: (data.summary_json as Record<string, unknown>) ?? {},
    version: Number(data.version ?? 1),
  };
  await cache.set(key, value, { ttlMs: CACHE_TTL_MS });
  return value;
}

export async function upsertFeatureSummary(params: {
  organizationId: string;
  businessId: string;
  feature: FeatureSummaryName;
  summary: Record<string, unknown>;
  jobId?: string | null;
}): Promise<void> {
  const supabase = createServiceClient();
  const { data: existing } = await supabase
    .from("feature_business_summaries")
    .select("version")
    .eq("business_id", params.businessId)
    .eq("feature", params.feature)
    .maybeSingle();
  const nextVersion = Number(existing?.version ?? 0) + 1;

  const { error } = await supabase.from("feature_business_summaries").upsert(
    {
      organization_id: params.organizationId,
      business_id: params.businessId,
      feature: params.feature,
      summary_json: params.summary,
      version: nextVersion,
      last_job_id: params.jobId ?? null,
      last_run_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "business_id,feature" }
  );

  if (error) {
    logger.warn("feature_summary_upsert_failed", {
      feature: params.feature,
      error: error.message,
    });
    return;
  }

  const cache = getCache();
  await cache.del(
    tenantCacheKey(params.organizationId, "summary", params.feature, params.businessId)
  );
}

/** Build a compact summary after a feature job completes. */
export async function rebuildFeatureSummaryAfterJob(params: {
  jobType: string;
  organizationId?: string | null;
  businessId?: string | null;
  jobId?: string | null;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const orgId = params.organizationId ?? null;
  const businessId = params.businessId ?? null;
  if (!orgId || !businessId) return;

  const feature = jobTypeToSummaryFeature(params.jobType);
  if (!feature) return;

  try {
    const summary = await loadLatestSummarySnapshot(feature, businessId);
    await upsertFeatureSummary({
      organizationId: orgId,
      businessId,
      feature,
      summary,
      jobId: params.jobId,
    });
  } catch (err) {
    logger.warn("feature_summary_rebuild_failed", {
      feature,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

function jobTypeToSummaryFeature(jobType: string): FeatureSummaryName | null {
  switch (jobType) {
    case "process_scan":
    case "scan_enrichment":
      return "maps";
    case "local_trust_run":
      return "local_trust";
    case "backlink_gap_run":
      return "backlink_gap";
    case "ai_visibility_run":
      return "ai_visibility";
    case "citation_audit":
      return "citations";
    case "reputation_audit":
      return "reputation";
    case "review_momentum_run":
      return "review_momentum";
    case "growth_audit_run":
    case "growth_audit_extended":
      return "growth_audit";
    case "campaign_send_batch":
      return "reviews_campaign";
    default:
      return null;
  }
}

async function loadLatestSummarySnapshot(
  feature: FeatureSummaryName,
  businessId: string
): Promise<Record<string, unknown>> {
  const supabase = createServiceClient();

  switch (feature) {
    case "maps": {
      const { data } = await supabase
        .from("scan_batches")
        .select("id, status, grid_size, cells_completed, cells_total, created_at, finished_at, rank_ready_at")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return { latestScan: data ?? null };
    }
    case "local_trust": {
      const { data } = await supabase
        .from("local_trust_runs")
        .select("id, status, city, state, opportunities_found, created_at, finished_at")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return { latestRun: data ?? null };
    }
    case "backlink_gap": {
      const { data } = await supabase
        .from("backlink_gap_runs")
        .select(
          "id, status, target_domain, missing_opportunity_count, high_priority_count, created_at, finished_at"
        )
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return { latestRun: data ?? null };
    }
    case "ai_visibility": {
      const { data } = await supabase
        .from("ai_visibility_runs")
        .select("id, status, created_at, finished_at, target_mentioned")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return { latestRun: data ?? null };
    }
    case "citations": {
      const { data } = await supabase
        .from("citation_audits")
        .select("id, status, score, created_at, finished_at")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return { latestAudit: data ?? null };
    }
    case "reputation": {
      const { data } = await supabase
        .from("reputation_audits")
        .select("id, status, score, created_at, finished_at")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return { latestAudit: data ?? null };
    }
    case "review_momentum": {
      const { data } = await supabase
        .from("review_momentum_runs")
        .select("id, status, created_at, finished_at")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return { latestRun: data ?? null };
    }
    case "growth_audit": {
      const { data } = await supabase
        .from("growth_audit_runs")
        .select("id, status, growth_score, created_at, finished_at")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return { latestRun: data ?? null };
    }
    case "reviews_campaign": {
      const { data: campaigns } = await supabase
        .from("review_request_campaigns")
        .select("id")
        .eq("business_id", businessId)
        .limit(50);
      const ids = (campaigns ?? []).map((c) => c.id as string);
      if (!ids.length) return { sentCount: 0, updatedAt: new Date().toISOString() };
      const { count } = await supabase
        .from("review_request_messages")
        .select("id", { count: "exact", head: true })
        .in("campaign_id", ids)
        .eq("status", "sent");
      return { sentCount: count ?? 0, updatedAt: new Date().toISOString() };
    }
    default:
      return {};
  }
}
