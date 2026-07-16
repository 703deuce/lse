import { NextResponse } from "next/server";
import { requireBusinessAccess, httpStatusForAuthError } from "@/lib/auth/api-auth";
import { PlanLimitError, releaseUsage, reserveUsageOrThrow } from "@/lib/plans";
import { dispatchFeatureJob } from "@/lib/queue/dispatch";
import { idempotencyTimeBucket } from "@/lib/queue/idempotency";

export async function POST(request: Request) {
  let reserved = false;
  let organizationId: string | undefined;
  try {
    const body = await request.json();
    const { businessId, city, state, county, rescan } = body as {
      businessId?: string;
      city?: string;
      state?: string;
      county?: string;
      rescan?: boolean;
    };

    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    const auth = await requireBusinessAccess(businessId);
    organizationId = auth.organizationId;
    await reserveUsageOrThrow(auth.organizationId, "local_trust_scans_used", 1);
    reserved = true;

    const job = await dispatchFeatureJob({
      jobType: "local_trust_run",
      payload: {
        businessId,
        organizationId: auth.organizationId,
        city,
        state,
        county,
        rescan,
        reservedUsage: { key: "local_trust_scans_used", amount: 1 },
      },
      organizationId: auth.organizationId,
      businessId,
      idempotencyKey: `local-trust:${businessId}:${city ?? ""}:${state ?? ""}:${rescan ? "r" : "i"}:${idempotencyTimeBucket()}`,
      priority: "normal",
      maxAttempts: 2,
    });

    if (job.enqueueState === "enqueue_failed") {
      await releaseUsage(auth.organizationId, "local_trust_scans_used", 1).catch(() => {});
      reserved = false;
      return NextResponse.json(
        { error: "Failed to queue Local Trust run", jobId: job.jobId },
        { status: 503 }
      );
    }

    if (job.reused) {
      await releaseUsage(auth.organizationId, "local_trust_scans_used", 1).catch(() => {});
    }
    reserved = false; // terminal failures release credits in the processor
    return NextResponse.json({
      queued: true,
      status: "queued",
      jobId: job.jobId,
      queueDriver: job.driver,
      reused: job.reused,
    });
  } catch (err) {
    if (reserved && organizationId) {
      await releaseUsage(organizationId, "local_trust_scans_used", 1).catch(() => {});
    }
    if (err instanceof PlanLimitError) {
      return NextResponse.json({ error: err.message, limitKey: err.limitKey }, { status: 402 });
    }
    const message = err instanceof Error ? err.message : "Local trust finder failed";
    return NextResponse.json({ error: message }, { status: httpStatusForAuthError(err) });
  }
}
