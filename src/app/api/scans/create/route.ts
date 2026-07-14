import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";
import { scheduleScanProcessing } from "@/lib/jobs/schedule-scan";
import { createScanSchema } from "@/lib/validation/schemas";
import { LOCAL_FALCON_PARITY } from "@/lib/maps/local-falcon-parity";
import {
  gridMapCredits,
  PlanLimitError,
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
        confidence_summary: {
          ...PARITY_SUMMARY,
          scan_profile: { device, os, browser },
          ...(parityLabel ? { parity_profile: parityLabel } : {}),
        },
      })
      .select("*")
      .single();

    if (error || !batch) {
      return NextResponse.json({ error: error?.message ?? "Failed to create scan" }, { status: 500 });
    }

    scheduleScanProcessing(batch.id, auth.organizationId);

    return NextResponse.json({ scan: batch });
  } catch (err) {
    if (err instanceof PlanLimitError) {
      return NextResponse.json({ error: err.message, limitKey: err.limitKey }, { status: 402 });
    }
    const message = err instanceof Error ? err.message : "Scan create failed";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
