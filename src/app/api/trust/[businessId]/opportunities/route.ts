import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { queryLocalTrustOpportunities } from "@/lib/local-trust/engine";

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
    const opportunityType = url.searchParams.get("type") || null;
    const displayGroup = url.searchParams.get("group") || null;
    const priority = url.searchParams.get("priority") || null;
    const competitorPresent = url.searchParams.get("competitorPresent") === "true";
    const status = (url.searchParams.get("status") ?? "open") as "open" | "all";
    const marketCity = url.searchParams.get("marketCity") || null;
    const marketState = url.searchParams.get("marketState") || null;
    const allMarkets = url.searchParams.get("allMarkets") === "true";
    const runId = url.searchParams.get("runId") || null;

    const data = await queryLocalTrustOpportunities({
      businessId,
      page,
      pageSize,
      opportunityType,
      displayGroup,
      priority,
      competitorPresent: competitorPresent || undefined,
      status,
      marketCity,
      marketState,
      allMarkets,
      runId,
    });

    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load opportunities";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
