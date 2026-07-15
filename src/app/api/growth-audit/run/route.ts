import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { PlanLimitError, releaseUsage, reserveUsageOrThrow } from "@/lib/plans";
import { dispatchFeatureJob } from "@/lib/queue/dispatch";

export async function POST(request: Request) {
  let reserved = false;
  let organizationId: string | undefined;
  try {
    const body = await request.json();
    const { businessId, keyword, skipBackground } = body as {
      businessId?: string;
      keyword?: string;
      skipBackground?: boolean;
    };

    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    const auth = await requireBusinessAccess(businessId);
    organizationId = auth.organizationId;
    await reserveUsageOrThrow(auth.organizationId, "growth_audits_used", 1);
    reserved = true;

    const job = await dispatchFeatureJob({
      jobType: "growth_audit_run",
      payload: {
        businessId,
        organizationId: auth.organizationId,
        keyword,
        skipBackground: Boolean(skipBackground),
        reservedUsage: { key: "growth_audits_used", amount: 1 },
      },
      organizationId: auth.organizationId,
      businessId,
      idempotencyKey: `growth-audit:${businessId}:${Math.floor(Date.now() / 30_000)}`,
      priority: "normal",
      maxAttempts: 2,
    });

    if (job.enqueueState === "enqueue_failed") {
      await releaseUsage(auth.organizationId, "growth_audits_used", 1).catch(() => {});
      reserved = false;
      return NextResponse.json(
        { error: "Failed to queue growth audit", jobId: job.jobId },
        { status: 503 }
      );
    }

    reserved = false;
    return NextResponse.json({
      queued: true,
      status: "queued",
      jobId: job.jobId,
      queueDriver: job.driver,
    });
  } catch (err) {
    if (reserved && organizationId) {
      await releaseUsage(organizationId, "growth_audits_used", 1).catch(() => {});
    }
    if (err instanceof PlanLimitError) {
      return NextResponse.json({ error: err.message, limitKey: err.limitKey }, { status: 402 });
    }
    const message = err instanceof Error ? err.message : "Growth audit failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
