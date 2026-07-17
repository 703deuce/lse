import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";
import { loadLocationScanSummaries } from "@/lib/maps/scan-queries";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    const url = new URL(request.url);
    const keywordId = url.searchParams.get("keywordId");
    const gridSize = Number(url.searchParams.get("gridSize") ?? 7);
    const radius = Number(url.searchParams.get("radius") ?? 8047);

    await requireBusinessAccess(businessId);
    const supabase = createServiceClient();

    if (!keywordId) {
      const { data: locations } = await supabase
        .from("rank_locations")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: true });

      const { data: business } = await supabase
        .from("businesses")
        .select("name, address_text, scan_center_label, lat, lng, scan_center_lat, scan_center_lng")
        .eq("id", businessId)
        .single();

      return NextResponse.json({
        businessLocation: {
          id: null,
          name: "Business location",
          address: business?.scan_center_label ?? business?.address_text ?? null,
          lat: business?.scan_center_lat ?? business?.lat ?? 0,
          lng: business?.scan_center_lng ?? business?.lng ?? 0,
        },
        locations: locations ?? [],
      });
    }

    const summaries = await loadLocationScanSummaries(
      supabase,
      businessId,
      keywordId,
      gridSize,
      radius
    );

    return NextResponse.json({ locations: summaries });
  } catch (err) {
    return httpErrorFromException(err, "Failed to load locations");
  }
}
