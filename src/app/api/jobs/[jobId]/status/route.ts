import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { isDevBypassEnabled } from "@/lib/auth/dev";
import { isAdminEmail } from "@/lib/auth/admin";
import {
  assertJobStatusRateLimit,
  getCompactJobStatus,
} from "@/lib/jobs/compact-job-status";

/**
 * Compact job status for adaptive polling.
 * AuthZ via caller's organization. Supports ETag / If-None-Match.
 * Never loads child cells, recipients, or provider JSON.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await context.params;
    if (!jobId || jobId.length < 8) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const auth = await requireAuth();
    const isAdmin = isAdminEmail(auth.email);

    const rate = assertJobStatusRateLimit({
      organizationId: auth.organizationId || "anon",
      jobId,
      maxPerWindow: 2,
      windowMs: 1000,
    });
    if (!rate.ok) {
      return NextResponse.json(
        { error: "Too many status requests", retryAfterMs: rate.retryAfterMs },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(rate.retryAfterMs / 1000)),
            "Cache-Control": "private, max-age=1",
          },
        }
      );
    }

    const bundle = await getCompactJobStatus(jobId);
    if (!bundle) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const { compact, organizationId } = bundle;

    if (!organizationId) {
      if (!isAdmin && !isDevBypassEnabled()) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    } else if (
      organizationId !== auth.organizationId &&
      !isAdmin &&
      !isDevBypassEnabled()
    ) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const etag = `"${compact.version}"`;
    const inm = request.headers.get("if-none-match");
    if (inm && inm === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          "Cache-Control": "private, max-age=1",
          "X-Job-Status-Cache": bundle.cacheHit ? "hit" : "miss",
        },
      });
    }

    // Backward-compatible shape + compact fields for new clients.
    const progress = {
      completed: compact.completedUnits ?? undefined,
      total: compact.totalUnits ?? undefined,
      failed: compact.failedUnits ?? undefined,
      percent: compact.progress ?? undefined,
      result: compact.result,
    };

    return NextResponse.json(
      {
        jobId: compact.jobId,
        jobType: compact.jobType,
        status: compact.status,
        phase: compact.phase,
        progress,
        completedUnits: compact.completedUnits,
        totalUnits: compact.totalUnits,
        failedUnits: compact.failedUnits,
        result: compact.result ?? null,
        updatedAt: compact.updatedAt,
        version: compact.version,
        errorMessage: compact.errorMessage,
        queueName: compact.queueName,
        enqueueState: compact.enqueueState,
      },
      {
        headers: {
          ETag: etag,
          "Cache-Control": "private, max-age=1",
          "X-Job-Status-Cache": bundle.cacheHit ? "hit" : "miss",
        },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Status failed";
    const status =
      message.includes("not authenticated") ||
      message.includes("Unauthorized") ||
      message.includes("Authentication required")
        ? 401
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
