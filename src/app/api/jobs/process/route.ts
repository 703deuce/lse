import { NextResponse } from "next/server";
import { processPendingJobs } from "@/lib/jobs/queue";
import { getRequestId } from "@/lib/observability/request-id";
import { logger } from "@/lib/observability/logger";
import { authorizeBearerSecret } from "@/lib/security/secrets";

async function handle(request: Request) {
  const authz = authorizeBearerSecret(request, process.env.CRON_SECRET);
  if (!authz.ok) {
    return NextResponse.json({ error: authz.error }, { status: authz.status });
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

/** Coolify may schedule GET; still requires Bearer CRON_SECRET. */
export async function GET(request: Request) {
  return handle(request);
}
