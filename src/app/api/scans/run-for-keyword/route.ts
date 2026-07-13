import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";
import { scheduleScanProcessing } from "@/lib/jobs/schedule-scan";
import { LOCAL_FALCON_PARITY } from "@/lib/maps/local-falcon-parity";

const schema = z.object({
  businessId: z.string().uuid(),
  keywordId: z.string().uuid().optional(),
  keyword: z.string().optional(),
  gridSize: z.number().int().min(3).max(11).default(7),
  radiusMeters: z.number().int().min(500).max(17000).default(8047),
  scanType: z.enum(["quick", "standard"]).default("quick"),
  device: z.enum(["desktop", "mobile"]).default("mobile"),
  os: z.enum(["android", "ios", "windows", "macos"]).default("android"),
  browser: z.enum(["chrome", "firefox"]).default("chrome"),
  locationId: z.string().uuid().optional().nullable(),
  centerLat: z.number().optional(),
  centerLng: z.number().optional(),
  centerLabel: z.string().optional(),
  movedFromScanId: z.string().uuid().optional(),
});

const PARITY_SUMMARY = {
  search_engine: LOCAL_FALCON_PARITY.searchEngine,
  search_this_area: LOCAL_FALCON_PARITY.searchThisArea,
  search_places: LOCAL_FALCON_PARITY.searchPlaces,
  se_domain: LOCAL_FALCON_PARITY.seDomain,
  language_code: LOCAL_FALCON_PARITY.languageCode,
  country_code: LOCAL_FALCON_PARITY.countryCode,
  location_zoom: LOCAL_FALCON_PARITY.locationZoom,
  grid_depth: LOCAL_FALCON_PARITY.gridDepth,
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const {
      businessId,
      keywordId,
      keyword,
      gridSize,
      radiusMeters,
      scanType,
      device,
      os,
      browser,
      locationId,
      centerLat,
      centerLng,
      centerLabel,
      movedFromScanId,
    } = parsed.data;
    const auth = await requireBusinessAccess(businessId);
    const supabase = createServiceClient();

    let resolvedKeywordId = keywordId;
    if (!resolvedKeywordId && keyword?.trim()) {
      const { data: kw } = await supabase
        .from("business_keywords")
        .select("id")
        .eq("business_id", businessId)
        .ilike("keyword", keyword.trim())
        .maybeSingle();
      resolvedKeywordId = kw?.id;
    }

    if (!resolvedKeywordId) {
      return NextResponse.json({ error: "keywordId or keyword required" }, { status: 400 });
    }

    const { data: kwRow } = await supabase
      .from("business_keywords")
      .select("id, keyword")
      .eq("id", resolvedKeywordId)
      .eq("business_id", businessId)
      .single();

    if (!kwRow) {
      return NextResponse.json({ error: "Keyword not found for business" }, { status: 404 });
    }

    const { data: batch, error } = await supabase
      .from("scan_batches")
      .insert({
        business_id: businessId,
        status: "queued",
        scan_type: "quick",
        grid_size: gridSize,
        radius_meters: radiusMeters,
        device,
        os,
        browser,
        provider: "brightdata",
        location_id: locationId ?? null,
        center_lat: centerLat ?? null,
        center_lng: centerLng ?? null,
        center_label: centerLabel?.trim() || null,
        moved_from_scan_id: movedFromScanId ?? null,
        confidence_summary: {
          ...PARITY_SUMMARY,
          scan_profile: { device, os, browser },
          keyword_ids: [resolvedKeywordId],
          keyword_label: String(kwRow.keyword).trim(),
          method: "live_parallel",
        },
      })
      .select("*")
      .single();

    if (error || !batch) {
      return NextResponse.json({ error: error?.message ?? "Failed to create scan" }, { status: 500 });
    }

    scheduleScanProcessing(batch.id, auth.organizationId);

    return NextResponse.json({
      scan: batch,
      keyword: { id: kwRow.id, keyword: String(kwRow.keyword).trim() },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Run scan failed";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
