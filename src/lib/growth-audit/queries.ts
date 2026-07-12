import { createServiceClient } from "@/lib/db/client";
import type { GrowthAuditRunRow, GrowthAuditSections } from "@/lib/growth-audit/types";

export async function getLatestGrowthAuditRun(businessId: string): Promise<GrowthAuditRunRow | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("growth_audit_runs")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return data as GrowthAuditRunRow;
}

export async function getGrowthAuditRun(runId: string): Promise<GrowthAuditRunRow | null> {
  const supabase = createServiceClient();
  const { data } = await supabase.from("growth_audit_runs").select("*").eq("id", runId).maybeSingle();
  if (!data) return null;
  return data as GrowthAuditRunRow;
}

export function parseSections(run: GrowthAuditRunRow): GrowthAuditSections {
  return run.sections_json as GrowthAuditSections;
}
