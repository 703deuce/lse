import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";
import { loadLatestBacklinkGapRun } from "@/lib/backlink-gap/engine";
import { hasFeature, PlanLimitError, releaseUsage, reserveUsageOrThrow } from "@/lib/plans";
import { dispatchFeatureJob } from "@/lib/queue/dispatch";

export async function POST(request: Request) {
  let reserved = false;
  let organizationId: string | undefined;
  try {
    const body = await request.json();
    const { businessId, scanBatchId, competitorLimit, selectedCompetitorIds, forceRefresh } = body as {
      businessId?: string;
      scanBatchId?: string;
      competitorLimit?: number;
      selectedCompetitorIds?: string[];
      forceRefresh?: boolean;
    };

    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    const auth = await requireBusinessAccess(businessId);
    organizationId = auth.organizationId;
    if (!(await hasFeature(auth.organizationId, "backlink_gap"))) {
      return NextResponse.json(
        { error: "Backlink Gap is not included in your plan." },
        { status: 403 }
      );
    }
    const supabase = createServiceClient();

    // Cache hits stay synchronous so the UI can render immediately without billing.
    if (!forceRefresh) {
      const { data: recent } = await supabase
        .from("backlink_gap_runs")
        .select("id, status, created_at, target_domain, target_ref_domain_count, competitor_ref_domain_count, missing_opportunity_count, high_priority_count, ai_summary")
        .eq("business_id", businessId)
        .in("status", ["ready", "partial"])
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (recent) {
        const loaded = await loadLatestBacklinkGapRun(businessId);
        return NextResponse.json({
          runId: recent.id,
          status: (recent.status as "ready" | "partial") ?? "ready",
          summary: (loaded?.run.ai_summary as string) ?? (recent.ai_summary as string) ?? null,
          targetDomain: (recent.target_domain as string) ?? "",
          targetRefDomainCount: (recent.target_ref_domain_count as number) ?? 0,
          competitorRefDomainCount: (recent.competitor_ref_domain_count as number) ?? 0,
          missingOpportunityCount: (recent.missing_opportunity_count as number) ?? 0,
          highPriorityCount: (recent.high_priority_count as number) ?? 0,
          warnings: ["Returned recent run from last 24 hours"],
          fromCache: true,
        });
      }
    }

    await reserveUsageOrThrow(auth.organizationId, "backlink_gap_runs_used", 1);
    reserved = true;

    const job = await dispatchFeatureJob({
      jobType: "backlink_gap_run",
      payload: {
        businessId,
        organizationId: auth.organizationId,
        scanBatchId,
        competitorLimit,
        selectedCompetitorIds,
        forceRefresh: true,
        reservedUsage: { key: "backlink_gap_runs_used", amount: 1 },
      },
      organizationId: auth.organizationId,
      businessId,
      idempotencyKey: `backlink-gap:${businessId}:${forceRefresh ? "force" : "n"}:${Math.floor(Date.now() / 30_000)}`,
      priority: "normal",
      maxAttempts: 2,
    });

    if (job.enqueueState === "enqueue_failed") {
      await releaseUsage(auth.organizationId, "backlink_gap_runs_used", 1).catch(() => {});
      reserved = false;
      return NextResponse.json(
        { error: "Failed to queue backlink gap run", jobId: job.jobId },
        { status: 503 }
      );
    }

    if (job.reused) {
      await releaseUsage(auth.organizationId, "backlink_gap_runs_used", 1).catch(() => {});
    }
    reserved = false;
    return NextResponse.json({
      queued: true,
      status: "queued",
      jobId: job.jobId,
      queueDriver: job.driver,
      reused: job.reused,
    });
  } catch (err) {
    if (reserved && organizationId) {
      await releaseUsage(organizationId, "backlink_gap_runs_used", 1).catch(() => {});
    }
    if (err instanceof PlanLimitError) {
      return NextResponse.json({ error: err.message, limitKey: err.limitKey }, { status: 402 });
    }
    return httpErrorFromException(err, "Backlink gap analysis failed");
  }
}
