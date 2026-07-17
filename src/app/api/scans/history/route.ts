import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";
import { loadScanHistory } from "@/lib/maps/scan-history";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const businessId = url.searchParams.get("businessId");
    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    await requireBusinessAccess(businessId);
    const supabase = createServiceClient();

    const mode = (url.searchParams.get("mode") ?? "target") as "target" | "competitor" | "keyword";
    const scans = await loadScanHistory(supabase, {
      businessId,
      keywordId: url.searchParams.get("keywordId"),
      locationId: url.searchParams.get("locationId"),
      gridSize: url.searchParams.get("gridSize")
        ? Number(url.searchParams.get("gridSize"))
        : null,
      radiusMeters: url.searchParams.get("radius")
        ? Number(url.searchParams.get("radius"))
        : null,
      mode,
      competitorKey: url.searchParams.get("competitorKey") ?? url.searchParams.get("competitorId"),
    });

    return NextResponse.json({ scans });
  } catch (err) {
    return httpErrorFromException(err, "Failed to load scan history");
  }
}
