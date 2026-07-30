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

const ROUTE = "growth-audit/run";
const JOB_TYPE = "growth_audit_run";

export async function POST(request: Request) {
  let reserved = false;
  let organizationId: string | undefined;
  let businessId: string | undefined;
  try {
    const body = await request.json();
    const parsed = body as {
      businessId?: string;
      keyword?: string;
      skipBackground?: boolean;
    };
    businessId = parsed.businessId;
    const { keyword, skipBackground } = parsed;

    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    logModuleRunStart({
      route: ROUTE,
      businessId,
      jobType: JOB_TYPE,
      action: "enqueue_job",
    });

    const auth = await requireBusinessAccess(businessId);
    organizationId = auth.organizationId;
    logModuleRunStep(
      { route: ROUTE, businessId, organizationId, jobType: JOB_TYPE },
      "auth_ok"
    );
    const rate = await assertRateLimit({
      key: `growth-audit:${auth.organizationId}`,
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
    if (!(await hasFeature(auth.organizationId, "growth_audit"))) {
      return NextResponse.json(
        { error: "Growth Audit is not included in your plan." },
        { status: 403 }
      );
    }
    await reserveUsageOrThrow(auth.organizationId, "growth_audits_used", 1);
    reserved = true;
    logModuleRunStep(
      { route: ROUTE, businessId, organizationId, jobType: JOB_TYPE },
      "usage_reserved"
    );

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
      logModuleRunEnqueueFailed(
        { route: ROUTE, businessId, organizationId, jobType: JOB_TYPE },
        job
      );
      await releaseUsage(auth.organizationId, "growth_audits_used", 1).catch(() => {});
      reserved = false;
      return NextResponse.json(
        { error: "Failed to queue growth audit", jobId: job.jobId },
        { status: 503 }
      );
    }

    // Idempotent reuse already owns the usage reservation from the first enqueue.
    if (job.reused) {
      await releaseUsage(auth.organizationId, "growth_audits_used", 1).catch(() => {});
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
      await releaseUsage(organizationId, "growth_audits_used", 1).catch(() => {});
    }
    logModuleRunError(
      { route: ROUTE, businessId, organizationId, jobType: JOB_TYPE },
      "handler",
      err
    );
    if (err instanceof PlanLimitError) {
      return NextResponse.json({ error: err.message, limitKey: err.limitKey }, { status: 402 });
    }
    return httpErrorFromException(err, "Growth audit failed", {
      route: ROUTE,
      businessId,
      organizationId,
      jobType: JOB_TYPE,
    });
  }
}
