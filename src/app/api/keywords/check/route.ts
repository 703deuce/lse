import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { dispatchFeatureJob } from "@/lib/queue/dispatch";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { businessId, keywordIds } = body as { businessId?: string; keywordIds?: string[] };

    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    const auth = await requireBusinessAccess(businessId);
    const job = await dispatchFeatureJob({
      jobType: "keyword_check",
      payload: {
        businessId,
        organizationId: auth.organizationId,
        keywordIds,
      },
      organizationId: auth.organizationId,
      businessId,
      idempotencyKey: `keyword-check:${businessId}:${Math.floor(Date.now() / 30_000)}`,
      priority: "normal",
      maxAttempts: 2,
    });

    if (job.enqueueState === "enqueue_failed") {
      return NextResponse.json(
        { error: "Failed to queue keyword check", jobId: job.jobId },
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
    return httpErrorFromException(err, "Keyword check failed");
  }
}
