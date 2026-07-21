import { NextResponse } from "next/server";
import { processPendingJobs } from "@/lib/jobs/queue";
import { getRequestId } from "@/lib/observability/request-id";
import { logger } from "@/lib/observability/logger";
import { authorizeBearerSecret } from "@/lib/security/secrets";
import { assertRedisEndpointReady } from "@/lib/queue/config";

async function handle(request: Request) {
  const authz = authorizeBearerSecret(request, process.env.CRON_SECRET);
  if (!authz.ok) {
    return NextResponse.json({ error: authz.error }, { status: authz.status });
  }

  try {
    assertRedisEndpointReady("jobs/process");
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Redis endpoint misconfigured" },
      { status: 503 }
    );
  }

  const requestId = getRequestId(request);
  const result = await processPendingJobs(10);
  logger.info("jobs_process_complete", {
    requestId,
    jobsProcessed: result.jobsProcessed,
    campaignSent: result.campaignSent,
    scansReclaimed: result.scansReclaimed,
    jobsReclaimed: result.jobsReclaimed,
    retention: result.retention ?? undefined,
  });
  return NextResponse.json({ requestId, ...result });
}

export async function POST(request: Request) {
  return handle(request);
}

/** Mutations must use POST — reject GET to avoid accidental crawler triggers. */
export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
