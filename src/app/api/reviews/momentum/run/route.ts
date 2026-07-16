import { NextResponse } from "next/server";
import { requireBusinessAccess, httpStatusForAuthError } from "@/lib/auth/api-auth";
import { dispatchFeatureJob } from "@/lib/queue/dispatch";
import { idempotencyTimeBucket } from "@/lib/queue/idempotency";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { businessId, scanBatchId, competitorLimit, lookbackDays } = body as {
      businessId?: string;
      scanBatchId?: string;
      competitorLimit?: number;
      lookbackDays?: number;
    };

    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    const auth = await requireBusinessAccess(businessId);
    const job = await dispatchFeatureJob({
      jobType: "review_momentum_run",
      payload: {
        businessId,
        organizationId: auth.organizationId,
        scanBatchId,
        competitorLimit,
        lookbackDays,
      },
      organizationId: auth.organizationId,
      businessId,
      idempotencyKey: `review-momentum:${businessId}:${scanBatchId ?? "all"}:${competitorLimit ?? "d"}:${lookbackDays ?? "d"}:${idempotencyTimeBucket()}`,
      priority: "normal",
      maxAttempts: 2,
    });

    if (job.enqueueState === "enqueue_failed") {
      return NextResponse.json(
        { error: "Failed to queue review momentum run", jobId: job.jobId },
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
    const message = err instanceof Error ? err.message : "Review momentum run failed";
    return NextResponse.json({ error: message }, { status: httpStatusForAuthError(err) });
  }
}
