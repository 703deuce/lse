import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";
import { scheduleScanProcessing } from "@/lib/jobs/schedule-scan";
import { createScanSchema } from "@/lib/validation/schemas";
import { LOCAL_FALCON_PARITY } from "@/lib/maps/local-falcon-parity";
import { USABLE_SCAN_STATUSES } from "@/lib/scans/status";
import {
  gridMapCredits,
  PlanLimitError,
  releaseUsage,
  reserveUsageOrThrow,
} from "@/lib/plans";

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
    const parsed = createScanSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const { businessId, gridSize, radiusMeters, device, os, browser, parityLabel } = parsed.data;
    const auth = await requireBusinessAccess(businessId);

    const creditsNeeded = gridMapCredits(gridSize);
    await reserveUsageOrThrow(auth.organizationId, "map_credits_used", creditsNeeded);

    const supabase = createServiceClient();

    try {
      const [{ data: business }, { data: primaryKw }, { data: latestScan }] = await Promise.all([
        supabase
          .from("businesses")
          .select("scan_center_lat, scan_center_lng, lat, lng, address_text")
          .eq("id", businessId)
          .maybeSingle(),
        supabase
          .from("business_keywords")
          .select("id, keyword")
          .eq("business_id", businessId)
          .order("is_primary", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("scan_batches")
          .select("center_lat, center_lng, center_label, location_id")
          .eq("business_id", businessId)
          .in("status", [...USABLE_SCAN_STATUSES])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const centerLat =
        latestScan?.center_lat ?? business?.scan_center_lat ?? business?.lat ?? null;
      const centerLng =
        latestScan?.center_lng ?? business?.scan_center_lng ?? business?.lng ?? null;
      const centerLabel = latestScan?.center_label ?? business?.address_text ?? null;

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
          location_id: latestScan?.location_id ?? null,
          center_lat: centerLat,
          center_lng: centerLng,
          center_label: centerLabel,
          confidence_summary: {
            ...PARITY_SUMMARY,
            scan_profile: { device, os, browser },
            ...(parityLabel ? { parity_profile: parityLabel } : {}),
            // Scope baseline Settings scans to the primary keyword — otherwise
            // processScanBatch fans out to every keyword for the same credit cost.
            ...(primaryKw?.id
              ? { keyword_ids: [primaryKw.id], keyword_label: primaryKw.keyword }
              : {}),
          },
        })
        .select("*")
        .single();

      if (error || !batch) {
        await releaseUsage(auth.organizationId, "map_credits_used", creditsNeeded).catch(() => {});
        return NextResponse.json({ error: error?.message ?? "Failed to create scan" }, { status: 500 });
      }

      scheduleScanProcessing(batch.id, auth.organizationId);

      return NextResponse.json({ scan: batch });
    } catch (inner) {
      await releaseUsage(auth.organizationId, "map_credits_used", creditsNeeded).catch(() => {});
      throw inner;
    }
  } catch (err) {
    if (err instanceof PlanLimitError) {
      return NextResponse.json({ error: err.message, limitKey: err.limitKey }, { status: 402 });
    }
    const message = err instanceof Error ? err.message : "Scan create failed";
    const status = message.includes("access denied") || message.includes("not found") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
