import { NextResponse } from "next/server";
import { processPendingJobs } from "@/lib/jobs/queue";

const CRON_SECRET = process.env.CRON_SECRET?.trim();

function authorize(request: Request): NextResponse | null {
  // Fail closed in production: unset secret must not open the worker.
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

  // Non-production: if a secret is set, still enforce it (local cron testing).
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
  const result = await processPendingJobs(10);
  return NextResponse.json(result);
}

export async function GET(request: Request) {
  return POST(request);
}
