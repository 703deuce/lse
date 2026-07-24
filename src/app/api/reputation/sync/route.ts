import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { isDevPreviewBusiness } from "@/lib/auth/dev";
import { hasFeature } from "@/lib/plans";
import { dispatchFeatureJob } from "@/lib/queue/dispatch";
import { assertRateLimit } from "@/lib/security/rate-limit";

/**
 * One-click reputation refresh: queues Review Momentum (fills feed / analytics /
 * competitors / insights) and Reputation Audit (health score / keyword gaps /
 * response audit) so every Intelligence page can load from the same sync.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { businessId, competitorLimit, lookbackDays, forceRefresh } = body as {
      businessId?: string;
      competitorLimit?: number;
      lookbackDays?: number;
      forceRefresh?: boolean;
    };

    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    // Local preview business has no queue/DB — acknowledge the CTA without enqueue.
    if (isDevPreviewBusiness(businessId)) {
      return NextResponse.json({
        queued: true,
        status: "preview",
        message:
          "Preview mode: sync is simulated. On a real business this queues Review Momentum + Reputation Audit together.",
        jobs: [
          { kind: "review_momentum_run", jobId: "preview", queued: true },
          { kind: "reputation_audit", jobId: "preview", queued: true },
        ],
      });
    }

    const auth = await requireBusinessAccess(businessId);
    const rate = await assertRateLimit({
      key: `reputation-sync:${auth.organizationId}`,
      maxPerWindow: 10,
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

    const canMomentum = await hasFeature(auth.organizationId, "review_momentum");
    const stamp = Math.floor(Date.now() / 30_000);
    const jobs: Array<{
      kind: "review_momentum_run" | "reputation_audit";
      jobId: string;
      queued: boolean;
      queueDriver?: string;
      skipped?: string;
    }> = [];

    if (canMomentum) {
      const momentum = await dispatchFeatureJob({
        jobType: "review_momentum_run",
        payload: {
          businessId,
          organizationId: auth.organizationId,
          competitorLimit,
          lookbackDays,
        },
        organizationId: auth.organizationId,
        businessId,
        idempotencyKey: `review-momentum:${businessId}:${stamp}`,
        priority: "normal",
        maxAttempts: 2,
      });
      jobs.push({
        kind: "review_momentum_run",
        jobId: momentum.jobId,
        queued: momentum.enqueueState !== "enqueue_failed",
        queueDriver: momentum.driver,
        skipped:
          momentum.enqueueState === "enqueue_failed"
            ? "Failed to queue review momentum run"
            : undefined,
      });
    } else {
      jobs.push({
        kind: "review_momentum_run",
        jobId: "",
        queued: false,
        skipped: "Review Momentum is not included in your plan.",
      });
    }

    const audit = await dispatchFeatureJob({
      jobType: "reputation_audit",
      payload: {
        businessId,
        organizationId: auth.organizationId,
        competitorLimit,
        lookbackDays,
        forceRefresh,
      },
      organizationId: auth.organizationId,
      businessId,
      idempotencyKey: `reputation-audit:${businessId}:${stamp}`,
      priority: "normal",
      maxAttempts: 2,
    });
    jobs.push({
      kind: "reputation_audit",
      jobId: audit.jobId,
      queued: audit.enqueueState !== "enqueue_failed",
      queueDriver: audit.driver,
      skipped:
        audit.enqueueState === "enqueue_failed"
          ? "Failed to queue reputation audit"
          : undefined,
    });

    const anyQueued = jobs.some((job) => job.queued);
    if (!anyQueued) {
      return NextResponse.json(
        {
          error: "Failed to queue reputation sync",
          jobs,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      queued: true,
      status: "queued",
      message:
        "Reputation sync queued. Feed, Analytics, Competitors, Insights, and Audit will refresh when jobs finish.",
      jobs,
    });
  } catch (err) {
    return httpErrorFromException(err, "Reputation sync failed");
  }
}
