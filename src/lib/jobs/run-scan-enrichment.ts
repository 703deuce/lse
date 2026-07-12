import { createServiceClient } from "@/lib/db/client";
import { aggregateCompetitors } from "@/lib/maps/grid";
import { enrichTargetBusiness, saveCompetitorSnapshots } from "@/lib/jobs/enrich-competitors";
import { runDeterministicAudit, findingsToActionItems } from "@/lib/scoring/audit-engine";
import { generateActionPlan } from "@/lib/providers/deepseek";
import { actionPlanOutputSchema } from "@/lib/validation/schemas";
import { probeWebsite } from "@/lib/rules/website-probe";
import { precomputeScanWorkspace } from "@/lib/maps/precompute-workspace";
import type { EnrichedProfile } from "@/lib/jobs/enrich-competitors";

function mapProfile(p: EnrichedProfile) {
  return {
    name: p.name,
    category: p.category ?? undefined,
    rating: p.rating,
    review_count: p.review_count,
    photo_count: p.photo_count,
    post_count: p.post_count,
    is_claimed: p.is_claimed,
    description: p.description,
    additional_categories: p.additional_categories,
    recent_review_count: p.recent_review_count,
  };
}

/**
 * Phase 2 — background enrichment, audit, cache precompute. Does not block rank map.
 */
export async function runScanEnrichment(
  scanBatchId: string,
  organizationId?: string
): Promise<void> {
  const supabase = createServiceClient();
  const now = new Date().toISOString();

  const { data: batch } = await supabase.from("scan_batches").select("*").eq("id", scanBatchId).single();
  if (!batch) throw new Error("Scan batch not found");

  if (batch.status === "ready" || batch.status === "partial") {
    return;
  }

  if (batch.status === "failed") {
    return;
  }

  await supabase
    .from("scan_batches")
    .update({
      status: "enriching",
      enrichment_status: "running",
      enrichment_started_at: batch.enrichment_started_at ?? now,
    })
    .eq("id", scanBatchId);

  try {
    const { data: business } = await supabase.from("businesses").select("*").eq("id", batch.business_id).single();
    if (!business) throw new Error("Business not found");

    const { data: keywords } = await supabase.from("business_keywords").select("*").eq("business_id", business.id);
    const primaryKeyword = keywords?.find((k) => k.is_primary) ?? keywords?.[0];
    if (!primaryKeyword) throw new Error("No keywords configured");

    const { data: points } = await supabase
      .from("scan_points")
      .select("id, distance_from_center_m")
      .eq("scan_batch_id", scanBatchId);
    const pointIds = (points ?? []).map((p) => p.id);
    const { data: results } = pointIds.length
      ? await supabase.from("scan_results").select("*").in("scan_point_id", pointIds)
      : { data: [] };

    const ranksByDistance = (results ?? []).map((r) => {
      const point = points?.find((p) => p.id === r.scan_point_id);
      return { distanceM: point?.distance_from_center_m ?? 0, rank: r.target_rank as number | null };
    });

    const aggregateMetrics = (batch.aggregate_metrics ?? {}) as Record<string, unknown>;
    const topCompetitors = aggregateCompetitors(results ?? [], {
      excludeCid: business.cid,
      excludePlaceId: business.place_id,
      excludeName: business.name,
      targetCategory: business.primary_category,
      keyword: primaryKeyword.keyword,
    });

    const targetProfile = await enrichTargetBusiness({
      name: business.name,
      cid: business.cid,
      placeId: business.place_id,
      city: primaryKeyword.city,
      state: primaryKeyword.state,
      lat: business.scan_center_lat ?? business.lat,
      lng: business.scan_center_lng ?? business.lng,
      organizationId,
    });

    const compProfiles = await saveCompetitorSnapshots({
      scanBatchId,
      competitors: topCompetitors,
      lat: business.scan_center_lat ?? business.lat,
      lng: business.scan_center_lng ?? business.lng,
      city: primaryKeyword.city,
      state: primaryKeyword.state,
      organizationId,
    });

    let websiteProbe = null;
    if (business.website_url) {
      websiteProbe = await probeWebsite(business.website_url, primaryKeyword.keyword);
    }

    await supabase.from("scan_batches").update({ status: "scoring" }).eq("id", scanBatchId);

    const { data: audit } = await supabase
      .from("audits")
      .insert({ business_id: business.id, scan_batch_id: scanBatchId, status: "running" })
      .select("*")
      .single();

    if (!audit) throw new Error("Failed to create audit");

    const auditResult = runDeterministicAudit({
      target: mapProfile(targetProfile),
      competitors: compProfiles.map(mapProfile),
      scanMetrics: {
        averageRank: Number(aggregateMetrics.averageRank ?? 0),
        top10Cells: Number(aggregateMetrics.top10Cells ?? 0),
        totalCells: Number(aggregateMetrics.totalCells ?? 0),
        ranksByDistance,
      },
      websiteProbe,
      keyword: primaryKeyword.keyword,
    });

    for (const finding of auditResult.findings) {
      await supabase.from("audit_findings").insert({ audit_id: audit.id, ...finding });
    }

    await supabase
      .from("audits")
      .update({
        status: "ready",
        relevance_score: auditResult.scores.relevance,
        distance_score: auditResult.scores.distance,
        prominence_score: auditResult.scores.prominence,
        trust_score: auditResult.scores.trust,
        overall_score: auditResult.scores.overall,
      })
      .eq("id", audit.id);

    await supabase.from("scan_batches").update({ status: "ai_planning" }).eq("id", scanBatchId);

    const { data: findings } = await supabase.from("audit_findings").select("*").eq("audit_id", audit.id);

    const model = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";
    const aiPlanRaw = await generateActionPlan({
      findings: findings ?? [],
      businessName: business.name,
      keyword: primaryKeyword.keyword,
      model,
      organizationId,
    });

    let aiPlan = null;
    if (aiPlanRaw) {
      const parsed = actionPlanOutputSchema.safeParse(aiPlanRaw);
      aiPlan = parsed.success ? parsed.data : null;
    }

    const { data: actionPlan } = await supabase
      .from("action_plans")
      .insert({
        audit_id: audit.id,
        llm_model: aiPlan ? model : null,
        summary: aiPlan?.summary ?? "Action plan based on audit findings.",
        status: aiPlan ? "ready" : "failed",
      })
      .select("*")
      .single();

    if (actionPlan) {
      const items =
        aiPlan?.actions?.map((a, i) => ({
          action_plan_id: actionPlan.id,
          title: a.title,
          description: a.description,
          bucket: a.bucket,
          impact: a.impact,
          effort: a.effort,
          priority_rank: i + 1,
          evidence_json: { reason_code: a.reason_code, refs: a.evidence_refs },
        })) ??
        findingsToActionItems(auditResult.findings).map((a) => ({
          action_plan_id: actionPlan.id,
          ...a,
        }));

      if (items.length) await supabase.from("action_items").insert(items);
    }

    void precomputeScanWorkspace(scanBatchId).catch((err) => {
      console.error("[precomputeScanWorkspace]", scanBatchId, err);
    });

    const cellsFailed = Number(batch.cells_failed ?? 0);
    const cellsTotal = Number(batch.cells_total ?? 0);
    const terminalStatus =
      cellsTotal > 0 && cellsFailed > 0 && cellsFailed < cellsTotal ? "partial" : "ready";
    const finishedAt = new Date().toISOString();

    await supabase
      .from("scan_batches")
      .update({
        status: terminalStatus,
        enrichment_status: "complete",
        enrichment_finished_at: finishedAt,
        ready_at: finishedAt,
        finished_at: finishedAt,
      })
      .eq("id", scanBatchId);
  } catch (err) {
    console.error("[runScanEnrichment]", scanBatchId, err);
    const message = err instanceof Error ? err.message : "Enrichment failed";
    await supabase
      .from("scan_batches")
      .update({
        status: "rank_ready",
        enrichment_status: "failed",
        error_message: message,
      })
      .eq("id", scanBatchId);
    throw err;
  }
}
