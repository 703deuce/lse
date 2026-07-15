import { createServiceClient } from "@/lib/db/client";
import { logger } from "@/lib/observability/logger";

export type UsageLedgerEntry = {
  organizationId: string;
  businessId?: string | null;
  userId?: string | null;
  jobId?: string | null;
  feature: string;
  provider: string;
  unitType: string;
  estimatedUnits?: number | null;
  actualUnits?: number | null;
  estimatedCostUsd?: number | null;
  actualCostUsd?: number | null;
  retryCostUsd?: number | null;
  billingPeriod?: string | null;
  metadata?: Record<string, unknown>;
};

/** Append a cost/usage row. Best-effort — never throw into feature critical path. */
export async function recordUsage(entry: UsageLedgerEntry): Promise<void> {
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("usage_ledger").insert({
      organization_id: entry.organizationId,
      business_id: entry.businessId ?? null,
      user_id: entry.userId ?? null,
      job_id: entry.jobId ?? null,
      feature: entry.feature,
      provider: entry.provider,
      unit_type: entry.unitType,
      estimated_units: entry.estimatedUnits ?? null,
      actual_units: entry.actualUnits ?? null,
      estimated_cost_usd: entry.estimatedCostUsd ?? null,
      actual_cost_usd: entry.actualCostUsd ?? null,
      retry_cost_usd: entry.retryCostUsd ?? 0,
      billing_period:
        entry.billingPeriod ??
        new Date().toISOString().slice(0, 7), // YYYY-MM
      metadata: entry.metadata ?? {},
    });
    if (error) {
      // Table may not exist until migration 045 is applied.
      logger.warn("usage_ledger_insert_failed", { error: error.message, feature: entry.feature });
    }
  } catch (err) {
    logger.warn("usage_ledger_insert_exception", {
      error: err instanceof Error ? err.message : String(err),
      feature: entry.feature,
    });
  }
}
