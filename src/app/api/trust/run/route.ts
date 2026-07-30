import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { hasFeature, PlanLimitError, releaseUsage, reserveUsageOrThrow } from "@/lib/plans";
import { dispatchFeatureJob } from "@/lib/queue/dispatch";
import { assertRateLimit } from "@/lib/security/rate-limit";
import {
  logModuleRunEnqueueFailed,
  logModuleRunError,
  logModuleRunQueued,
  logModuleRunStart,
  logModuleRunStep,
} from "@/lib/observability/module-run-log";

const ROUTE = "trust/run";
const JOB_TYPE = "local_trust_run";

export async function POST(request: Request) {
  let reserved = false;
  let organizationId: string | undefined;
  let businessId: string | undefined;
  try {
    const body = await request.json();
    const parsed = body as {
      businessId?: string;
      city?: string;
      state?: string;
      county?: string;
      rescan?: boolean;
    };
    businessId = parsed.businessId;
    const { city, state, county, rescan } = parsed;

    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    logModuleRunStart({
      route: ROUTE,
      businessId,
      jobType: JOB_TYPE,
      action: "enqueue_job",
      rescan: Boolean(rescan),
      city,
      state,
    });

    const auth = await requireBusinessAccess(businessId);
    organizationId = auth.organizationId;
    const rate = await assertRateLimit({
      key: `trust-run:${auth.organizationId}`,
      maxPerWindow: 25,
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
    if (!(await hasFeature(auth.organizationId, "local_trust"))) {
      return NextResponse.json(
        { error: "Local Trust is not included in your plan." },
        { status: 403 }
      );
    }
    await reserveUsageOrThrow(auth.organizationId, "local_trust_scans_used", 1);
    reserved = true;
    logModuleRunStep(
      { route: ROUTE, businessId, organizationId, jobType: JOB_TYPE },
      "usage_reserved"
    );

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
      idempotencyKey: `local-trust:${businessId}:${city ?? ""}:${state ?? ""}:${rescan ? "r" : "i"}:${Math.floor(Date.now() / 30_000)}`,
      priority: "normal",
      maxAttempts: 2,
    });

    if (job.enqueueState === "enqueue_failed") {
      logModuleRunEnqueueFailed(
        { route: ROUTE, businessId, organizationId, jobType: JOB_TYPE },
        job
      );
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
    reserved = false;
    logModuleRunQueued(
      { route: ROUTE, businessId, organizationId, jobType: JOB_TYPE },
      job
    );
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
    logModuleRunError(
      { route: ROUTE, businessId, organizationId, jobType: JOB_TYPE },
      "handler",
      err
    );
    if (err instanceof PlanLimitError) {
      return NextResponse.json({ error: err.message, limitKey: err.limitKey }, { status: 402 });
    }
    return httpErrorFromException(err, "Local trust finder failed", {
      route: ROUTE,
      businessId,
      organizationId,
      jobType: JOB_TYPE,
    });
  }
}
