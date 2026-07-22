import { createServiceClient } from "@/lib/db/client";
import { findKeywordByText } from "@/lib/maps/scan-queries";

const MAX_KEYWORDS = 3;

export async function startProspectAudit(params: {
  organizationId: string;
  businessId: string;
  keywords: string[];
}): Promise<{ auditId: string; scanBatchIds: string[]; warnings: string[] }> {
  const keywords = [
    ...new Set(
      params.keywords
        .map((k) => k.trim())
        .filter(Boolean)
        .slice(0, MAX_KEYWORDS)
    ),
  ];
  if (!keywords.length) {
    throw new Error("Add at least one keyword (up to 3) to run a prospect audit.");
  }

  const supabase = createServiceClient();
  const warnings: string[] = [];
  const scanBatchIds: string[] = [];

  const { data: audit, error: insertErr } = await supabase
    .from("prospect_audits")
    .insert({
      organization_id: params.organizationId,
      business_id: params.businessId,
      status: "running",
      keywords,
      primary_keyword: keywords[0],
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertErr || !audit?.id) {
    // Table may not exist yet — still run underlying jobs and return a synthetic id path.
    if (insertErr && /prospect_audits|does not exist/i.test(insertErr.message)) {
      warnings.push("prospect_audits table missing — running scans without persisted audit row");
    } else {
      throw new Error(insertErr?.message ?? "Failed to create prospect audit");
    }
  }

  const auditId = (audit?.id as string | undefined) ?? `ephemeral-${params.businessId}`;

  // Ensure keywords exist, then trigger Maps scans via internal fetch pattern from callers.
  for (const keyword of keywords) {
    let keywordId: string | null = null;
    const existing = await findKeywordByText(supabase, params.businessId, keyword);
    if (existing?.id) {
      keywordId = existing.id;
    } else {
      const { data: created, error } = await supabase
        .from("business_keywords")
        .insert({
          business_id: params.businessId,
          keyword,
          is_primary: keyword === keywords[0],
          active: true,
        })
        .select("id")
        .single();
      if (error || !created?.id) {
        warnings.push(`Could not add keyword “${keyword}”: ${error?.message ?? "unknown"}`);
        continue;
      }
      keywordId = created.id as string;
    }
    void keywordId;
  }

  return { auditId, scanBatchIds, warnings };
}

export async function attachProspectAuditJobs(params: {
  auditId: string;
  growthAuditRunId?: string | null;
  scanBatchIds?: string[];
  status?: "running" | "ready" | "failed" | "shared";
  errorMessage?: string | null;
}) {
  if (params.auditId.startsWith("ephemeral-")) return;
  const supabase = createServiceClient();
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (params.growthAuditRunId) patch.growth_audit_run_id = params.growthAuditRunId;
  if (params.scanBatchIds?.length) patch.scan_batch_ids = params.scanBatchIds;
  if (params.status) {
    patch.status = params.status;
    if (params.status === "ready" || params.status === "failed" || params.status === "shared") {
      patch.finished_at = new Date().toISOString();
    }
    if (params.status === "shared") {
      patch.shared_at = new Date().toISOString();
    }
  }
  if (params.errorMessage !== undefined) patch.error_message = params.errorMessage;
  await supabase.from("prospect_audits").update(patch).eq("id", params.auditId);
}

export { MAX_KEYWORDS };
