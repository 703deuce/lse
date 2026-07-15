import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { dispatchFeatureJob } from "@/lib/queue/dispatch";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { businessId, competitorLimit, vertical, forceRefresh } = body as {
      businessId?: string;
      competitorLimit?: number;
      vertical?: string;
      forceRefresh?: boolean;
    };

    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    const auth = await requireBusinessAccess(businessId);
    const job = await dispatchFeatureJob({
      jobType: "citation_audit",
      payload: {
        businessId,
        organizationId: auth.organizationId,
        competitorLimit,
        vertical,
        forceRefresh,
      },
      organizationId: auth.organizationId,
      businessId,
      idempotencyKey: `citation-audit:${businessId}:${Math.floor(Date.now() / 30_000)}`,
      priority: "normal",
      maxAttempts: 2,
    });

    if (job.enqueueState === "enqueue_failed") {
      return NextResponse.json(
        { error: "Failed to queue citation audit", jobId: job.jobId },
        { status: 503 }
      );
    }

    return NextResponse.json({
      queued: true,
      status: "queued",
      jobId: job.jobId,
      queueDriver: job.driver,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Citation audit failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
