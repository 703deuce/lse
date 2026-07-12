import { NextResponse } from "next/server";
import { processPendingJobs } from "@/lib/jobs/queue";

const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await processPendingJobs(10);
  return NextResponse.json(result);
}

export async function GET(request: Request) {
  return POST(request);
}
