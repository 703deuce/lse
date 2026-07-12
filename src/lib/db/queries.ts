import { createServiceClient } from "@/lib/db/client";
import type {
  BusinessRow,
  ScanBatchRow,
  BusinessKeywordRow,
  AuditRow,
  AuditFindingRow,
  ActionPlanRow,
  ActionItemRow,
  ScanResultRow,
  ScanPointRow,
} from "@/lib/db/types";

export async function getBusiness(businessId: string, organizationId: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", businessId)
    .eq("organization_id", organizationId)
    .single();
  return data as BusinessRow | null;
}

export async function getLatestScan(businessId: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("scan_batches")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as ScanBatchRow | null;
}

export async function getBusinessKeywords(businessId: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("business_keywords")
    .select("*")
    .eq("business_id", businessId);
  return (data ?? []) as BusinessKeywordRow[];
}

export async function getScanWithResults(scanId: string) {
  const supabase = createServiceClient();
  const { data: batch } = await supabase.from("scan_batches").select("*").eq("id", scanId).single();
  const { data: points } = await supabase.from("scan_points").select("*").eq("scan_batch_id", scanId);
  const pointIds = ((points ?? []) as ScanPointRow[]).map((p) => p.id);
  let results: ScanResultRow[] = [];
  if (pointIds.length) {
    const { data } = await supabase.from("scan_results").select("*").in("scan_point_id", pointIds);
    results = (data ?? []) as ScanResultRow[];
  }
  return {
    batch: batch as ScanBatchRow | null,
    points: (points ?? []) as ScanPointRow[],
    results,
  };
}

export async function getLatestAudit(businessId: string, scanBatchId?: string) {
  const supabase = createServiceClient();
  let query = supabase.from("audits").select("*").eq("business_id", businessId);
  if (scanBatchId) query = query.eq("scan_batch_id", scanBatchId);
  const { data } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data as AuditRow | null;
}

export async function getAuditFindings(auditId: string) {
  const supabase = createServiceClient();
  const { data } = await supabase.from("audit_findings").select("*").eq("audit_id", auditId);
  return (data ?? []) as AuditFindingRow[];
}

export async function getActionPlanForAudit(auditId: string) {
  const supabase = createServiceClient();
  const { data: planData } = await supabase
    .from("action_plans")
    .select("*")
    .eq("audit_id", auditId)
    .maybeSingle();
  const plan = planData as ActionPlanRow | null;
  if (!plan) return { plan: null, items: [] as ActionItemRow[] };
  const { data } = await supabase
    .from("action_items")
    .select("*")
    .eq("action_plan_id", plan.id)
    .order("priority_rank");
  return { plan, items: (data ?? []) as ActionItemRow[] };
}

export type Business = BusinessRow;
export type ScanBatch = ScanBatchRow;
