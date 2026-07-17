import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { getLocalTrustTypeCounts } from "@/lib/local-trust/engine";

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
    const allMarkets = url.searchParams.get("allMarkets") === "true";

    const counts = await getLocalTrustTypeCounts(
      businessId,
      marketCity && marketState ? { city: marketCity, state: marketState } : null,
      allMarkets
    );
    return NextResponse.json({ counts });
  } catch (err) {
    return httpErrorFromException(err, "Failed to load counts");
  }
}
