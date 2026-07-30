import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { dispatchFeatureJob } from "@/lib/queue/dispatch";
import { assertRateLimit } from "@/lib/security/rate-limit";
import {
  logModuleRunEnqueueFailed,
  logModuleRunError,
  logModuleRunQueued,
  logModuleRunStart,
} from "@/lib/observability/module-run-log";

const ROUTE = "keywords/check";
const JOB_TYPE = "keyword_check";

export async function POST(request: Request) {
  let businessId: string | undefined;
  let organizationId: string | undefined;
  try {
    const body = await request.json();
    const parsed = body as { businessId?: string; keywordIds?: string[] };
    businessId = parsed.businessId;
    const { keywordIds } = parsed;

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
    const rate = await assertRateLimit({
      key: `keywords-check:${auth.organizationId}`,
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
      logModuleRunEnqueueFailed(
        { route: ROUTE, businessId, organizationId, jobType: JOB_TYPE },
        job
      );
      return NextResponse.json(
        { error: "Failed to queue keyword check", jobId: job.jobId },
        { status: 503 }
      );
    }

    logModuleRunQueued(
      { route: ROUTE, businessId, organizationId, jobType: JOB_TYPE },
      job
    );
    return NextResponse.json({
      queued: true,
      status: "queued",
      jobId: job.jobId,
      queueDriver: job.driver,
    });
  } catch (err) {
    logModuleRunError(
      { route: ROUTE, businessId, organizationId, jobType: JOB_TYPE },
      "handler",
      err
    );
    return httpErrorFromException(err, "Keyword check failed", {
      route: ROUTE,
      businessId,
      organizationId,
      jobType: JOB_TYPE,
    });
  }
}
