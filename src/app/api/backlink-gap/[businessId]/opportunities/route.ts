import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { queryBacklinkGapOpportunities } from "@/lib/backlink-gap/engine";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    await requireBusinessAccess(businessId);

    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") ?? "1");
    const pageSize = Number(url.searchParams.get("pageSize") ?? "10");
    const status = (url.searchParams.get("status") ?? "open") as "open" | "ignored" | "all";
    const competitorName = url.searchParams.get("competitor") || null;
    const linkFilter = (url.searchParams.get("linkFilter") ?? "all") as "all" | "dofollow" | "nofollow";
    const topicalFilter = (url.searchParams.get("topicalFilter") ?? "all") as "all" | "topical" | "random";

    const priorityFilter = (url.searchParams.get("priorityFilter") ?? "all") as
      | "all"
      | "high"
      | "medium"
      | "low";

    const data = await queryBacklinkGapOpportunities({
      businessId,
      page,
      pageSize,
      status,
      competitorName,
      linkFilter,
      topicalFilter,
      priorityFilter,
    });

    return NextResponse.json(data);
  } catch (err) {
    return httpErrorFromException(err, "Failed to load opportunities");
  }
}
