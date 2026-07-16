import { NextResponse } from "next/server";
import { httpStatusForAuthError, requireBusinessAccess } from "@/lib/auth/api-auth";
import { dispatchFeatureJob } from "@/lib/queue/dispatch";
import { idempotencyTimeBucket, payloadIdKey } from "@/lib/queue/idempotency";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { businessId, keywordIds } = body as { businessId?: string; keywordIds?: string[] };

    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    const auth = await requireBusinessAccess(businessId);
    const job = await dispatchFeatureJob({
      jobType: "keyword_volume",
      payload: {
        businessId,
        organizationId: auth.organizationId,
        keywordIds,
      },
      organizationId: auth.organizationId,
      businessId,
      idempotencyKey: `keyword-volume:${businessId}:${payloadIdKey(keywordIds)}:${idempotencyTimeBucket()}`,
      priority: "normal",
      maxAttempts: 2,
    });

    if (job.enqueueState === "enqueue_failed") {
      return NextResponse.json(
        { error: "Failed to queue volume refresh", jobId: job.jobId },
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
    const message = err instanceof Error ? err.message : "Volume refresh failed";
    return NextResponse.json({ error: message }, { status: httpStatusForAuthError(err) });
  }
}
