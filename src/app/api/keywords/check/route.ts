import { NextResponse } from "next/server";
import { httpStatusForAuthError, requireBusinessAccess } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";
import { PlanLimitError, releaseUsage, reserveUsageOrThrow } from "@/lib/plans";
import { dispatchFeatureJob } from "@/lib/queue/dispatch";
import { idempotencyTimeBucket, payloadIdKey } from "@/lib/queue/idempotency";

export async function POST(request: Request) {
  let reserved = false;
  let organizationId: string | undefined;
  let creditsNeeded = 0;
  try {
    const body = await request.json();
    const { businessId, keywordIds } = body as { businessId?: string; keywordIds?: string[] };

    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    const auth = await requireBusinessAccess(businessId);
    organizationId = auth.organizationId;
    const supabase = createServiceClient();

    if (keywordIds?.length) {
      creditsNeeded = keywordIds.length;
    } else {
      const { count } = await supabase
        .from("tracked_keywords")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .eq("active", true);
      creditsNeeded = count ?? 0;
    }

    if (!creditsNeeded) {
      return NextResponse.json({ error: "No active keywords to check" }, { status: 400 });
    }

    await reserveUsageOrThrow(auth.organizationId, "map_credits_used", creditsNeeded);
    reserved = true;

    const job = await dispatchFeatureJob({
      jobType: "keyword_check",
      payload: {
        businessId,
        organizationId: auth.organizationId,
        keywordIds,
        reservedUsage: { key: "map_credits_used", amount: creditsNeeded },
      },
      organizationId: auth.organizationId,
      businessId,
      idempotencyKey: `keyword-check:${businessId}:${payloadIdKey(keywordIds)}:${idempotencyTimeBucket()}`,
      priority: "normal",
      maxAttempts: 2,
    });

    if (job.enqueueState === "enqueue_failed") {
      await releaseUsage(auth.organizationId, "map_credits_used", creditsNeeded).catch(() => {});
      reserved = false;
      return NextResponse.json(
        { error: "Failed to queue keyword check", jobId: job.jobId },
        { status: 503 }
      );
    }

    if (job.reused) {
      await releaseUsage(auth.organizationId, "map_credits_used", creditsNeeded).catch(() => {});
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
    if (reserved && organizationId && creditsNeeded) {
      await releaseUsage(organizationId, "map_credits_used", creditsNeeded).catch(() => {});
    }
    if (err instanceof PlanLimitError) {
      return NextResponse.json({ error: err.message, limitKey: err.limitKey }, { status: 402 });
    }
    const message = err instanceof Error ? err.message : "Keyword check failed";
    return NextResponse.json({ error: message }, { status: httpStatusForAuthError(err) });
  }
}
