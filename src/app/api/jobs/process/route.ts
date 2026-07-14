import { NextResponse } from "next/server";
import { processPendingJobs } from "@/lib/jobs/queue";
import { getRequestId } from "@/lib/observability/request-id";
import { logger } from "@/lib/observability/logger";

const CRON_SECRET = process.env.CRON_SECRET?.trim();

function authorize(request: Request): NextResponse | null {
  if (process.env.NODE_ENV === "production") {
    if (!CRON_SECRET) {
      return NextResponse.json(
        { error: "CRON_SECRET is not configured" },
        { status: 503 }
      );
    }
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return null;
  }

  if (CRON_SECRET) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  return null;
}

export async function POST(request: Request) {
  const denied = authorize(request);
  if (denied) return denied;
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

export async function GET(request: Request) {
  return POST(request);
}
