import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";
import { dispatchScanProcessing } from "@/lib/jobs/schedule-scan";
import { createScanSchema } from "@/lib/validation/schemas";
import { LOCAL_FALCON_PARITY } from "@/lib/maps/local-falcon-parity";
import { USABLE_SCAN_STATUSES } from "@/lib/scans/status";
import {
  gridMapCredits,
  PlanLimitError,
  releaseUsage,
  reserveUsageOrThrow,
} from "@/lib/plans";
import { assertCanEnqueueMapsScan, findDuplicateActiveScan } from "@/lib/queue";

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

function isUsableCenter(lat: number | null | undefined, lng: number | null | undefined): boolean {
  if (lat == null || lng == null) return false;
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return false;
  if (Number(lat) === 0 && Number(lng) === 0) return false;
  return true;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createScanSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const { businessId, gridSize, radiusMeters, device, os, browser, parityLabel, centerLat: bodyLat, centerLng: bodyLng, centerLabel: bodyLabel } = parsed.data;
    const auth = await requireBusinessAccess(businessId);
    const supabase = createServiceClient();

    const [{ data: business }, { data: primaryKw }, { data: latestScan }, { count: keywordCount }] =
      await Promise.all([
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
        supabase
          .from("business_keywords")
          .select("id", { count: "exact", head: true })
          .eq("business_id", businessId),
      ]);

    // Prefer explicit request center (Settings map), then saved business baseline,
    // then last scan — so dragging the Settings pin actually takes effect.
    const centerLat =
      bodyLat ??
      business?.scan_center_lat ??
      latestScan?.center_lat ??
      business?.lat ??
      null;
    const centerLng =
      bodyLng ??
      business?.scan_center_lng ??
      latestScan?.center_lng ??
      business?.lng ??
      null;
    const centerLabel =
      bodyLabel?.trim() ||
      business?.address_text ||
      latestScan?.center_label ||
      null;

    if (!isUsableCenter(centerLat, centerLng)) {
      return NextResponse.json(
        { error: "Set a scan center before running a grid scan." },
        { status: 400 }
      );
    }
    if (!keywordCount) {
      return NextResponse.json(
        { error: "Add at least one keyword before running a grid scan." },
        { status: 400 }
      );
    }

    const keywordLabel = primaryKw?.keyword ?? null;
    const duplicate = await findDuplicateActiveScan({
      businessId,
      keywordLabel,
      gridSize,
      radiusMeters,
    });
    if (duplicate) {
      return NextResponse.json(
        {
          error: "An equivalent scan is already queued or running for this keyword and grid.",
          scan: { id: duplicate.id, status: duplicate.status },
          duplicate: true,
        },
        { status: 409 }
      );
    }

    const fairness = await assertCanEnqueueMapsScan({
      organizationId: auth.organizationId,
      businessId,
      scanBatchId: "00000000-0000-0000-0000-000000000000",
      keyword: keywordLabel,
      gridSize,
    });
    if (!fairness.ok && (fairness.code === "queued_limit" || fairness.code === "active_limit")) {
      return NextResponse.json(
        { error: fairness.reason, code: fairness.code },
        { status: 429 }
      );
    }

    const creditsNeeded = gridMapCredits(gridSize);
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

      const dispatched = await dispatchScanProcessing({
        scanBatchId: batch.id,
        businessId,
        organizationId: auth.organizationId,
      });

      return NextResponse.json({ scan: batch, jobId: dispatched.jobId, queueDriver: dispatched.driver });
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
