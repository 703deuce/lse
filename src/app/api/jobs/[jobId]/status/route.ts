import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { isDevBypassEnabled } from "@/lib/auth/dev";
import { getJobStatus } from "@/lib/queue";
import { derivePhase } from "@/lib/jobs/active-job-status";

/**
 * Lightweight job status for adaptive polling.
 * Authorizes via the caller's organization — never trusts a client-supplied org id.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await context.params;
    const auth = await requireAuth();
    const job = await getJobStatus(jobId);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (
      job.organizationId &&
      job.organizationId !== auth.organizationId &&
      !isDevBypassEnabled()
    ) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const progress = job.progress as {
      completed?: number;
      total?: number;
      failed?: number;
      result?: unknown;
    };

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      phase: derivePhase(job.status, progress),
      progress,
      result: progress?.result ?? null,
      updatedAt: job.heartbeatAt ?? job.finishedAt ?? job.startedAt ?? job.scheduledAt,
      errorMessage: job.errorMessage,
      queueName: job.queueName,
      enqueueState: job.enqueueState,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Status failed";
    const status =
      message.includes("not authenticated") || message.includes("Unauthorized")
        ? 401
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
