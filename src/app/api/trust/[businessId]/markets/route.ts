import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { listLocalTrustMarkets, listLocalTrustRuns, suggestNearbyMarkets } from "@/lib/local-trust/markets";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    await requireBusinessAccess(businessId);

    const url = new URL(request.url);
    const view = url.searchParams.get("view");
    const city = url.searchParams.get("city") || "";
    const state = url.searchParams.get("state") || "";

    if (view === "runs") {
      const runs = await listLocalTrustRuns(businessId);
      return NextResponse.json({ runs });
    }

    const markets = await listLocalTrustMarkets(businessId);
    const suggestions =
      city && state ? await suggestNearbyMarkets(businessId, city, state) : [];

    return NextResponse.json({ markets, suggestions });
  } catch (err) {
    return httpErrorFromException(err, "Failed to load markets");
  }
}
