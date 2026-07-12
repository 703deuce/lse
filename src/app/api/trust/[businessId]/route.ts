import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { loadLatestLocalTrustRun, queryLocalTrustOpportunities } from "@/lib/local-trust/engine";
import { countMarketAcceptedOpportunities } from "@/lib/local-trust/markets";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    await requireBusinessAccess(businessId);

    const url = new URL(request.url);
    const marketCity = url.searchParams.get("marketCity") || undefined;
    const marketState = url.searchParams.get("marketState") || undefined;
    const runId = url.searchParams.get("runId") || undefined;
    const allMarkets = url.searchParams.get("allMarkets") === "true";

    const data = await loadLatestLocalTrustRun(businessId, {
      city: allMarkets ? undefined : marketCity,
      state: allMarkets ? undefined : marketState,
      runId,
    });

    if (!data) {
      return NextResponse.json({ run: null, opportunities: [], tasks: [], searchQueries: [] });
    }

    let marketTotal = data.run?.opportunities_found ?? 0;
    if (allMarkets) {
      const { listLocalTrustMarkets } = await import("@/lib/local-trust/markets");
      const markets = await listLocalTrustMarkets(businessId);
      marketTotal = markets.reduce((sum, m) => sum + m.acceptedCount, 0);
    } else if (marketCity && marketState) {
      marketTotal = await countMarketAcceptedOpportunities(businessId, marketCity, marketState);
    }

    return NextResponse.json({ ...data, marketTotal });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load local trust data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
