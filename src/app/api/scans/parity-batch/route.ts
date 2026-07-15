import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";
import { dispatchScanProcessing } from "@/lib/jobs/schedule-scan";
import { PARITY_TEST_PROFILES } from "@/lib/maps/scan-profiles";
import { DEFAULT_RADIUS_METERS } from "@/lib/maps/grid-metrics";
import { LOCAL_FALCON_PARITY } from "@/lib/maps/local-falcon-parity";
import {
  gridMapCredits,
  PlanLimitError,
  releaseUsage,
  reserveUsageOrThrow,
} from "@/lib/plans";

/** Queue 4× 5×5 scans with different device/OS/browser profiles for Local Falcon comparison */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const businessId = body.businessId as string;
    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    const auth = await requireBusinessAccess(businessId);
    const supabase = createServiceClient();
    const gridSize = 5;
    const radiusMeters = Number(body.radiusMeters) || DEFAULT_RADIUS_METERS;
    const creditsPerScan = gridMapCredits(gridSize);
    const creditsNeeded = creditsPerScan * PARITY_TEST_PROFILES.length;

    await reserveUsageOrThrow(auth.organizationId, "map_credits_used", creditsNeeded);

    const scans = [];
    let created = 0;
    try {
      for (const profile of PARITY_TEST_PROFILES) {
        const { data: batch, error } = await supabase
          .from("scan_batches")
          .insert({
            business_id: businessId,
            status: "queued",
            scan_type: "quick",
            grid_size: gridSize,
            radius_meters: radiusMeters,
            device: profile.device,
            os: profile.os,
            browser: profile.browser,
            provider: "brightdata",
            confidence_summary: {
              search_engine: LOCAL_FALCON_PARITY.searchEngine,
              search_this_area: LOCAL_FALCON_PARITY.searchThisArea,
              search_places: LOCAL_FALCON_PARITY.searchPlaces,
              se_domain: LOCAL_FALCON_PARITY.seDomain,
              language_code: LOCAL_FALCON_PARITY.languageCode,
              country_code: LOCAL_FALCON_PARITY.countryCode,
              location_zoom: LOCAL_FALCON_PARITY.locationZoom,
              grid_depth: LOCAL_FALCON_PARITY.gridDepth,
              parity_profile: profile.id,
              parity_label: profile.label,
              scan_profile: {
                device: profile.device,
                os: profile.os,
                browser: profile.browser,
              },
            },
          })
          .select("*")
          .single();

        if (error || !batch) {
          const unused = creditsNeeded - created * creditsPerScan;
          if (unused > 0) {
            await releaseUsage(auth.organizationId, "map_credits_used", unused).catch(() => {});
          }
          return NextResponse.json({ error: error?.message ?? "Failed to create parity scan" }, { status: 500 });
        }

        await dispatchScanProcessing({
          scanBatchId: batch.id,
          businessId,
          organizationId: auth.organizationId,
        });
        scans.push({ profile: profile.label, profileId: profile.id, scanId: batch.id });
        created += 1;
      }
    } catch (inner) {
      const unused = creditsNeeded - created * creditsPerScan;
      if (unused > 0) {
        await releaseUsage(auth.organizationId, "map_credits_used", unused).catch(() => {});
      }
      throw inner;
    }

    return NextResponse.json({ scans, gridSize, radiusMeters });
  } catch (err) {
    if (err instanceof PlanLimitError) {
      return NextResponse.json({ error: err.message, limitKey: err.limitKey }, { status: 402 });
    }
    const message = err instanceof Error ? err.message : "Parity batch failed";
    const status = message.includes("access denied") || message.includes("not found") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
