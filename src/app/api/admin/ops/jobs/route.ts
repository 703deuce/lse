import { requirePlatformAdmin } from "@/lib/auth/admin";
import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { listJobsForAdmin } from "@/lib/queue/ledger";

export async function GET(request: Request) {
  try {
    const auth = await requirePlatformAdmin();

    const url = new URL(request.url);
    const jobs = await listJobsForAdmin({
      status: url.searchParams.get("status"),
      jobType: url.searchParams.get("jobType"),
      organizationId: url.searchParams.get("organizationId"),
      q: url.searchParams.get("q"),
      limit: Number(url.searchParams.get("limit") ?? 50) || 50,
    });

    return NextResponse.json({ jobs });
  } catch (err) {
    return httpErrorFromException(err);
  }
}
