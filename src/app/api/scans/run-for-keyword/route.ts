import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { z } from "zod";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { requireOrganizationPermission } from "@/lib/auth/permissions";
import { createServiceClient } from "@/lib/db/client";
import { dispatchScanProcessing } from "@/lib/jobs/schedule-scan";
import { LOCAL_FALCON_PARITY } from "@/lib/maps/local-falcon-parity";
import {
  getOrganizationPlan,
  gridMapCredits,
  PlanLimitError,
  releaseUsage,
  reserveUsageOrThrow,
} from "@/lib/plans";
import {
  assertGridSizeAllowed,
  resolveFreelancerLimits,
} from "@/lib/plans/resolve-freelancer-limits";
import { assertCanEnqueueMapsScan } from "@/lib/queue/fairness";
import { DEFAULT_RADIUS_METERS, MAX_RADIUS_METERS, MIN_RADIUS_METERS } from "@/lib/maps/grid-metrics";
import {
  DEFAULT_MAPS_PROVIDER_MODE,
  parseMapsProviderMode,
  scanBatchProviderColumn,
} from "@/lib/maps/provider-modes";
import {
  DEFAULT_DFS_EXECUTION_MODE,
  parseDfsExecutionMode,
} from "@/lib/maps/dfs-execution-modes";
import { parseMapsLocationZoom } from "@/lib/maps/maps-zoom";
import { assertRateLimit } from "@/lib/security/rate-limit";
import { trackProductEvent } from "@/lib/analytics/product-events";
import { customerSafeScanError } from "@/lib/scans/customer-safe-error";

const schema = z.object({
  businessId: z.string().uuid(),
  keywordId: z.string().uuid().optional(),
  keyword: z.string().optional(),
  gridSize: z.number().int().min(3).max(13).default(7),
  radiusMeters: z
    .number()
    .int()
    .min(MIN_RADIUS_METERS)
    .max(MAX_RADIUS_METERS)
    .default(DEFAULT_RADIUS_METERS),
  scanType: z.enum(["quick", "standard"]).default("quick"),
  device: z.enum(["desktop", "mobile"]).default("desktop"),
  os: z.enum(["android", "ios", "windows", "macos"]).default("windows"),
  browser: z.enum(["chrome", "firefox"]).default("chrome"),
  mapsProviderMode: z.enum(["hybrid", "scrapingdog", "dataforseo"]).default("dataforseo"),
  dfsExecutionMode: z.enum(["priority", "standard", "live"]).default("priority"),
  /** Production Falcon-match zoom is 14. */
  locationZoom: z.number().int().min(0).max(18).default(14),
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
      return NextResponse.json(
        { error: "Check the scan settings and try again." },
        { status: 400 }
      );
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
      mapsProviderMode: rawMode,
      dfsExecutionMode: rawDfsMode,
      locationZoom: rawZoom,
      locationId,
      centerLat,
      centerLng,
      centerLabel,
      movedFromScanId,
      excludedLabels = [],
    } = parsed.data;
    const mapsProviderMode = parseMapsProviderMode(rawMode ?? DEFAULT_MAPS_PROVIDER_MODE);
    const dfsExecutionMode = parseDfsExecutionMode(rawDfsMode ?? DEFAULT_DFS_EXECUTION_MODE);
    const locationZoom = parseMapsLocationZoom(rawZoom);
    const auth = await requireBusinessAccess(businessId);
    await requireOrganizationPermission("scan.run", auth.organizationId);
    const rate = await assertRateLimit({
      key: `scans-run-for-keyword:${auth.organizationId}`,
      maxPerWindow: 25,
      windowMs: 60_000,
    });
    if (!rate.ok) {
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(rate.retryAfterMs / 1000)) },
        }
      );
    }
    const plan = await getOrganizationPlan(auth.organizationId);
    const limits = resolveFreelancerLimits(plan.id);
    const gridOk = assertGridSizeAllowed(gridSize, limits);
    if (!gridOk.ok) {
      return NextResponse.json({ error: gridOk.message }, { status: 400 });
    }
    const supabase = createServiceClient();

    let resolvedKeywordId = keywordId;
    const requestedKeyword = keyword?.trim();
    if (!resolvedKeywordId && requestedKeyword) {
      const { data: kw } = await supabase
        .from("business_keywords")
        .select("id, active")
        .eq("business_id", businessId)
        .ilike("keyword", requestedKeyword)
        .maybeSingle();
      resolvedKeywordId = kw?.id;
      if (kw?.id && kw.active === false) {
        await supabase
          .from("business_keywords")
          .update({ active: true })
          .eq("id", kw.id)
          .eq("business_id", businessId);
      }
    }

    if (!resolvedKeywordId && requestedKeyword) {
      const { data: existingKeywords } = await supabase
        .from("business_keywords")
        .select("id, city, state, is_primary")
        .eq("business_id", businessId);
      const primary = (existingKeywords ?? []).find((k) => k.is_primary) ?? existingKeywords?.[0];
      const { data: inserted, error: insertKeywordError } = await supabase
        .from("business_keywords")
        .insert({
          business_id: businessId,
          keyword: requestedKeyword,
          city: primary?.city ?? null,
          state: primary?.state ?? null,
          is_primary: false,
          active: true,
          sort_order: (existingKeywords ?? []).length,
        })
        .select("id")
        .single();
      if (insertKeywordError || !inserted?.id) {
        return NextResponse.json(
          { error: "Could not save that keyword. Try a different keyword." },
          { status: 400 }
        );
      }
      resolvedKeywordId = inserted.id as string;
    }

    if (!resolvedKeywordId) {
      return NextResponse.json(
        { error: "Choose a keyword before starting the scan." },
        { status: 400 }
      );
    }

    const { data: kwRow } = await supabase
      .from("business_keywords")
      .select("id, keyword")
      .eq("id", resolvedKeywordId)
      .eq("business_id", businessId)
      .single();

    if (!kwRow) {
      return NextResponse.json(
        { error: "Choose a valid keyword for this location." },
        { status: 404 }
      );
    }

    const { data: business } = await supabase
      .from("businesses")
      .select("scan_center_lat, scan_center_lng, scan_center_label, lat, lng, address_text")
      .eq("id", businessId)
      .maybeSingle();

    const resolvedCenterLat = centerLat ?? business?.scan_center_lat ?? business?.lat ?? null;
    const resolvedCenterLng = centerLng ?? business?.scan_center_lng ?? business?.lng ?? null;
    const resolvedCenterLabel =
      centerLabel?.trim() ||
      business?.scan_center_label ||
      business?.address_text ||
      null;

    if (
      resolvedCenterLat == null ||
      resolvedCenterLng == null ||
      !Number.isFinite(Number(resolvedCenterLat)) ||
      !Number.isFinite(Number(resolvedCenterLng)) ||
      (Number(resolvedCenterLat) === 0 && Number(resolvedCenterLng) === 0)
    ) {
      return NextResponse.json(
        { error: "Set a scan center before running a Maps scan." },
        { status: 400 }
      );
    }

    // Persist explicit center (including first private address for service-area listings).
    if (centerLat != null && centerLng != null) {
      await supabase
        .from("businesses")
        .update({
          scan_center_lat: resolvedCenterLat,
          scan_center_lng: resolvedCenterLng,
          ...(resolvedCenterLabel ? { scan_center_label: resolvedCenterLabel } : {}),
        })
        .eq("id", businessId);
    }

    const uniqueExcluded = [...new Set(excludedLabels.map((l) => l.trim().toUpperCase()).filter(Boolean))];
    if (uniqueExcluded.length >= gridSize * gridSize) {
      return NextResponse.json(
        { error: "Include at least one grid point before running a scan." },
        { status: 400 }
      );
    }

    const fairness = await assertCanEnqueueMapsScan({
      organizationId: auth.organizationId,
      businessId,
      scanBatchId: "00000000-0000-0000-0000-000000000000",
      keyword: String(kwRow.keyword),
      gridSize,
    });
    if (!fairness.ok && (fairness.code === "queued_limit" || fairness.code === "active_limit")) {
      return NextResponse.json(
        { error: fairness.reason, code: fairness.code },
        { status: 429 }
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
          provider: scanBatchProviderColumn(mapsProviderMode),
          location_id: locationId ?? null,
          center_lat: resolvedCenterLat,
          center_lng: resolvedCenterLng,
          center_label: resolvedCenterLabel,
          moved_from_scan_id: movedFromScanId ?? null,
          confidence_summary: {
            ...PARITY_SUMMARY,
            location_zoom: locationZoom,
            scan_profile: { device, os, browser },
            maps_provider_mode: mapsProviderMode,
            dfs_execution_mode: dfsExecutionMode,
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

      trackProductEvent("scan_started", {
        organizationId: auth.organizationId,
        businessId,
        scanId: batch.id,
      });

      return NextResponse.json({
        scan: batch,
        keyword: { id: kwRow.id, keyword: String(kwRow.keyword).trim() },
        jobId: dispatched.jobId,
        queueDriver: dispatched.driver,
        // Clients must leave the live grid wait page — scan continues in the worker.
        redirectTo: `/businesses/${businessId}/overview`,
      });
    } catch (inner) {
      await releaseUsage(auth.organizationId, "map_credits_used", creditsNeeded).catch(() => {});
      throw inner;
    }
  } catch (err) {
    if (err instanceof PlanLimitError) {
      return NextResponse.json({ error: err.message, limitKey: err.limitKey }, { status: 402 });
    }
    const safe = customerSafeScanError(err instanceof Error ? err.message : String(err));
    return httpErrorFromException(err, safe ?? "We couldn't start the scan. Check the location and keyword, then try again.");
  }
}
