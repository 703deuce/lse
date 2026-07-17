import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { z } from "zod";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";
import { dispatchScanProcessing } from "@/lib/jobs/schedule-scan";
import { LOCAL_FALCON_PARITY } from "@/lib/maps/local-falcon-parity";
import {
  gridMapCredits,
  PlanLimitError,
  releaseUsage,
  reserveUsageOrThrow,
} from "@/lib/plans";
import { DEFAULT_RADIUS_METERS, MAX_RADIUS_METERS, MIN_RADIUS_METERS } from "@/lib/maps/grid-metrics";

const schema = z.object({
  businessId: z.string().uuid(),
  keywordId: z.string().uuid().optional(),
  keyword: z.string().optional(),
  gridSize: z.number().int().min(3).max(11).default(7),
  radiusMeters: z
    .number()
    .int()
    .min(MIN_RADIUS_METERS)
    .max(MAX_RADIUS_METERS)
    .default(DEFAULT_RADIUS_METERS),
  scanType: z.enum(["quick", "standard"]).default("quick"),
  device: z.enum(["desktop", "mobile"]).default("mobile"),
  os: z.enum(["android", "ios", "windows", "macos"]).default("android"),
  browser: z.enum(["chrome", "firefox"]).default("chrome"),
  locationId: z.string().uuid().optional().nullable(),
  centerLat: z.number().optional(),
  centerLng: z.number().optional(),
  centerLabel: z.string().optional(),
  movedFromScanId: z.string().uuid().optional(),
  excludedLabels: z.array(z.string().min(1).max(8)).max(121).optional(),
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
      device,
      os,
      browser,
      locationId,
      centerLat,
      centerLng,
      centerLabel,
      movedFromScanId,
      excludedLabels = [],
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

    const { data: business } = await supabase
      .from("businesses")
      .select("scan_center_lat, scan_center_lng, lat, lng, address_text")
      .eq("id", businessId)
      .maybeSingle();

    const resolvedCenterLat = centerLat ?? business?.scan_center_lat ?? business?.lat ?? null;
    const resolvedCenterLng = centerLng ?? business?.scan_center_lng ?? business?.lng ?? null;
    const resolvedCenterLabel =
      centerLabel?.trim() || business?.address_text || null;

    if (
      resolvedCenterLat == null ||
      resolvedCenterLng == null ||
      !Number.isFinite(Number(resolvedCenterLat)) ||
      !Number.isFinite(Number(resolvedCenterLng)) ||
      (Number(resolvedCenterLat) === 0 && Number(resolvedCenterLng) === 0)
    ) {
      return NextResponse.json(
        { error: "Set a scan center before running a grid scan." },
        { status: 400 }
      );
    }

    const uniqueExcluded = [...new Set(excludedLabels.map((l) => l.trim().toUpperCase()).filter(Boolean))];
    if (uniqueExcluded.length >= gridSize * gridSize) {
      return NextResponse.json(
        { error: "Include at least one grid point before running a scan." },
        { status: 400 }
      );
    }

    const creditsNeeded = gridMapCredits(gridSize, uniqueExcluded.length);
    await reserveUsageOrThrow(auth.organizationId, "map_credits_used", creditsNeeded);

    try {
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
          center_lat: resolvedCenterLat,
          center_lng: resolvedCenterLng,
          center_label: resolvedCenterLabel,
          moved_from_scan_id: movedFromScanId ?? null,
          confidence_summary: {
            ...PARITY_SUMMARY,
            scan_profile: { device, os, browser },
            keyword_ids: [resolvedKeywordId],
            keyword_label: String(kwRow.keyword).trim(),
            method: "live_parallel",
            ...(uniqueExcluded.length ? { excluded_labels: uniqueExcluded } : {}),
            included_cells: gridSize * gridSize - uniqueExcluded.length,
          },
        })
        .select("*")
        .single();

      if (error || !batch) {
        await releaseUsage(auth.organizationId, "map_credits_used", creditsNeeded).catch(() => {});
        return NextResponse.json({ error: error?.message ?? "Failed to create scan" }, { status: 500 });
      }

      const dispatched = await dispatchScanProcessing({
        scanBatchId: batch.id,
        businessId,
        organizationId: auth.organizationId,
      });

      return NextResponse.json({
        scan: batch,
        keyword: { id: kwRow.id, keyword: String(kwRow.keyword).trim() },
        jobId: dispatched.jobId,
        queueDriver: dispatched.driver,
      });
    } catch (inner) {
      await releaseUsage(auth.organizationId, "map_credits_used", creditsNeeded).catch(() => {});
      throw inner;
    }
  } catch (err) {
    if (err instanceof PlanLimitError) {
      return NextResponse.json({ error: err.message, limitKey: err.limitKey }, { status: 402 });
    }
    return httpErrorFromException(err, "Run scan failed");
  }
}
