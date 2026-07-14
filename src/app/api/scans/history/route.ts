import { NextResponse } from "next/server";
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
    const message = err instanceof Error ? err.message : "Failed to load scan history";
    const status = message.includes("access denied") || message.includes("not found") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
