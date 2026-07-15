import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { isAdminEmail } from "@/lib/auth/admin";
import { listJobsForAdmin } from "@/lib/queue/ledger";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    if (!isAdminEmail(auth.email)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

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
    const message = err instanceof Error ? err.message : "Failed to list jobs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
