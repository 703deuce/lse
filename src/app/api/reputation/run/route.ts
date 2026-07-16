import { NextResponse } from "next/server";
import { requireBusinessAccess, httpStatusForAuthError } from "@/lib/auth/api-auth";
import { dispatchFeatureJob } from "@/lib/queue/dispatch";
import { idempotencyTimeBucket } from "@/lib/queue/idempotency";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { businessId, competitorLimit, lookbackDays, forceRefresh } = body as {
      businessId?: string;
      competitorLimit?: number;
      lookbackDays?: number;
      forceRefresh?: boolean;
    };

    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    const auth = await requireBusinessAccess(businessId);
    const job = await dispatchFeatureJob({
      jobType: "reputation_audit",
      payload: {
        businessId,
        organizationId: auth.organizationId,
        competitorLimit,
        lookbackDays,
        forceRefresh,
      },
      organizationId: auth.organizationId,
      businessId,
      idempotencyKey: `reputation-audit:${businessId}:${forceRefresh ? "f" : "n"}:${competitorLimit ?? "d"}:${lookbackDays ?? "d"}:${idempotencyTimeBucket()}`,
      priority: "normal",
      maxAttempts: 2,
    });

    if (job.enqueueState === "enqueue_failed") {
      return NextResponse.json(
        { error: "Failed to queue reputation audit", jobId: job.jobId },
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
    const message = err instanceof Error ? err.message : "Reputation audit failed";
    return NextResponse.json({ error: message }, { status: httpStatusForAuthError(err) });
  }
}
