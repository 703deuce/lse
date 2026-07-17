import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { hasFeature, PlanLimitError, releaseUsage, reserveUsageOrThrow } from "@/lib/plans";
import { dispatchFeatureJob } from "@/lib/queue/dispatch";
import { assertRateLimit } from "@/lib/security/rate-limit";
import { httpErrorFromException } from "@/lib/security/http-errors";

export async function POST(request: Request) {
  let reserved = false;
  let organizationId: string | undefined;
  try {
    const body = await request.json();
    const { businessId, maxPrompts, promptIds } = body as {
      businessId?: string;
      maxPrompts?: number;
      promptIds?: string[];
    };

    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    const auth = await requireBusinessAccess(businessId);
    const rate = await assertRateLimit({
      key: `ai-visibility:${auth.organizationId}`,
      maxPerWindow: 30,
      windowMs: 60_000,
    });
    if (!rate.ok) {
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(rate.retryAfterMs / 1000)) },
        }
      );
    }
    if (!(await hasFeature(auth.organizationId, "ai_visibility"))) {
      return NextResponse.json({ error: "AI Visibility is not included in your plan." }, { status: 403 });
    }
    organizationId = auth.organizationId;
    await reserveUsageOrThrow(auth.organizationId, "ai_visibility_runs_used", 1);
    reserved = true;

    const job = await dispatchFeatureJob({
      jobType: "ai_visibility_run",
      payload: {
        businessId,
        organizationId: auth.organizationId,
        maxPrompts: maxPrompts ?? 1,
        promptIds,
        reservedUsage: { key: "ai_visibility_runs_used", amount: 1 },
      },
      organizationId: auth.organizationId,
      businessId,
      idempotencyKey: `ai-visibility:${businessId}:${Math.floor(Date.now() / 30_000)}`,
      priority: "normal",
      maxAttempts: 2,
    });

    if (job.enqueueState === "enqueue_failed") {
      await releaseUsage(auth.organizationId, "ai_visibility_runs_used", 1).catch(() => {});
      reserved = false;
      return NextResponse.json(
        { error: "Failed to queue AI Visibility run", jobId: job.jobId },
        { status: 503 }
      );
    }

    if (job.reused) {
      await releaseUsage(auth.organizationId, "ai_visibility_runs_used", 1).catch(() => {});
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
      await releaseUsage(organizationId, "ai_visibility_runs_used", 1).catch(() => {});
    }
    if (err instanceof PlanLimitError) {
      return NextResponse.json({ error: err.message, limitKey: err.limitKey }, { status: 402 });
    }
    return httpErrorFromException(err, "AI visibility check failed");
  }
}
