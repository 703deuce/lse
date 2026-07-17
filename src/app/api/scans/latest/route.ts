import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";
import {
  findKeywordByText,
  findLatestScanForKeyword,
  loadKeywordScanSummaries,
} from "@/lib/maps/scan-queries";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const businessId = url.searchParams.get("businessId");
    const keyword = url.searchParams.get("keyword")?.trim();
    const gridSize = Number(url.searchParams.get("gridSize") ?? 7);
    const radius = Number(url.searchParams.get("radius") ?? url.searchParams.get("radiusMeters") ?? 8047);
    const listAll = url.searchParams.get("list") === "1";
    const locationId = url.searchParams.get("locationId");

    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    await requireBusinessAccess(businessId);
    const supabase = createServiceClient();

    const locFilter =
      locationId === "business" || locationId === ""
        ? null
        : locationId ?? undefined;

    if (listAll) {
      const keywords = await loadKeywordScanSummaries(supabase, businessId, gridSize, radius, locFilter);
      return NextResponse.json({ keywords });
    }

    if (!keyword) {
      return NextResponse.json({ error: "keyword required" }, { status: 400 });
    }

    const kwRow = await findKeywordByText(supabase, businessId, keyword);
    if (!kwRow) {
      return NextResponse.json({ scan: null, keyword: null, message: "Keyword not tracked" });
    }

    const batch = await findLatestScanForKeyword(supabase, {
      businessId,
      keywordId: kwRow.id,
      gridSize,
      radiusMeters: radius,
      locationId: locFilter,
    });

    return NextResponse.json({
      scan: batch,
      keyword: { id: kwRow.id, keyword: String(kwRow.keyword).trim() },
    });
  } catch (err) {
    return httpErrorFromException(err, "Latest scan lookup failed");
  }
}
