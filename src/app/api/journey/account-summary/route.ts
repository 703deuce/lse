import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";
import { httpErrorFromException } from "@/lib/security/http-errors";

/**
 * Compact rollup for prospect/client overview pages.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const businessId = url.searchParams.get("businessId");
    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }
    await requireBusinessAccess(businessId);
    const supabase = createServiceClient();

    const [
      { data: latestScan },
      { count: scanCount },
      { data: latestAudit },
      { data: latestAi },
      { count: openBacklinks },
      { count: acquiredBacklinks },
      { count: openTrustTasks },
      { data: latestReport },
      { count: campaignCount },
      { data: business },
    ] = await Promise.all([
      supabase
        .from("scan_batches")
        .select("id, status, finished_at, confidence_summary, aggregate_metrics, created_at")
        .eq("business_id", businessId)
        .in("status", ["ready", "partial", "rank_ready"])
        .order("finished_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("scan_batches")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId),
      supabase
        .from("growth_audit_runs")
        .select("id, status, created_at, growth_score")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("ai_visibility_runs")
        .select("id, status, finished_at, created_at, visibility_score, target_mentioned")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("backlink_gap_opportunities")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .eq("status", "open"),
      supabase
        .from("backlink_gap_opportunities")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .eq("status", "completed"),
      supabase
        .from("local_trust_tasks")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .neq("status", "complete"),
      supabase
        .from("reports")
        .select(
          "id, report_type, publish_status, generated_at, share_last_viewed_at, share_token"
        )
        .eq("business_id", businessId)
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("maps_campaigns")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .is("archived_at", null),
      supabase
        .from("businesses")
        .select("id, rating, review_count")
        .eq("id", businessId)
        .maybeSingle(),
    ]);

    const conf = (latestScan?.confidence_summary ?? {}) as {
      keyword_label?: string;
    };
    const agg = (latestScan?.aggregate_metrics ?? {}) as {
      averageRank?: number | null;
      top3Cells?: number | null;
      totalCells?: number | null;
    };
    const top3Pct =
      agg.top3Cells != null && agg.totalCells
        ? Math.round((agg.top3Cells / agg.totalCells) * 100)
        : null;

    return NextResponse.json({
      visibility: {
        latestScanId: latestScan?.id ?? null,
        latestKeyword: conf.keyword_label ?? null,
        latestScanAt: latestScan?.finished_at ?? latestScan?.created_at ?? null,
        avgRank: agg.averageRank ?? null,
        top3Pct,
        scanCount: scanCount ?? 0,
        campaignCount: campaignCount ?? 0,
      },
      growthAudit: latestAudit
        ? {
            id: latestAudit.id,
            status: latestAudit.status,
            at: latestAudit.created_at,
            growthScore: latestAudit.growth_score ?? null,
          }
        : null,
      aiVisibility: latestAi
        ? {
            id: latestAi.id,
            status: latestAi.status,
            at: latestAi.finished_at ?? latestAi.created_at,
            visibilityScore: latestAi.visibility_score ?? null,
            targetMentioned: latestAi.target_mentioned ?? null,
          }
        : null,
      authority: {
        openBacklinkOpportunities: openBacklinks ?? 0,
        acquiredBacklinks: acquiredBacklinks ?? 0,
        openTrustTasks: openTrustTasks ?? 0,
      },
      reputation: {
        rating: business?.rating ?? null,
        reviewCount: business?.review_count ?? null,
      },
      report: latestReport
        ? {
            id: latestReport.id,
            publishStatus: latestReport.publish_status,
            viewedAt: latestReport.share_last_viewed_at,
            at: latestReport.generated_at,
            type: latestReport.report_type,
            hasShare: Boolean(latestReport.share_token),
          }
        : null,
    });
  } catch (err) {
    return httpErrorFromException(err, "Failed to load account summary");
  }
}
