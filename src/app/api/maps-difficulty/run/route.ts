import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireAuth } from "@/lib/auth/context";
import { assertRateLimit } from "@/lib/security/rate-limit";
import { BUSINESS_BASE_GEOCODE_ERROR, geocodeAddress, geocodeBusinessBase } from "@/lib/maps-difficulty/geocode";
import { requireInternalMapsDifficulty } from "@/lib/auth/plan-guards";
import { dispatchFeatureJob } from "@/lib/queue/dispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Queues Maps Keyword Difficulty (Bright Data / ScrapingDog heavy).
 * UI should poll job status then reload history — never blocks 300s on the web process.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    await requireInternalMapsDifficulty(auth.organizationId);

    const rate = await assertRateLimit({
      key: `maps-difficulty:${auth.organizationId}`,
      maxPerWindow: 10,
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

    const body = (await request.json()) as {
      keyword?: string;
      lat?: number;
      lng?: number;
      label?: string;
      address?: string;
      service?: string;
      businessBaseAddress?: string;
      businessBaseLat?: number;
      businessBaseLng?: number;
      /** Escape hatch for local debugging only. */
      sync?: boolean;
    };

    const keyword = body.keyword?.trim();
    if (!keyword) return NextResponse.json({ error: "keyword is required" }, { status: 400 });

    let lat = typeof body.lat === "number" ? body.lat : Number(body.lat);
    let lng = typeof body.lng === "number" ? body.lng : Number(body.lng);
    let label = body.label?.trim() || "";
    const address = body.address?.trim() || null;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      if (!address) {
        return NextResponse.json({ error: "Provide an address/location or a search point" }, { status: 400 });
      }
      const geo = await geocodeAddress(address);
      lat = geo.lat;
      lng = geo.lng;
      if (!label) label = geo.label;
    }

    if (!label) label = address || keyword;

    // Geocode business base while the request is still auth'd / light.
    let businessBase: Record<string, unknown> | null = null;
    const businessBaseAddress = body.businessBaseAddress?.trim();
    if (businessBaseAddress || (body.businessBaseLat != null && body.businessBaseLng != null)) {
      try {
        let baseLat = typeof body.businessBaseLat === "number" ? body.businessBaseLat : Number(body.businessBaseLat);
        let baseLng = typeof body.businessBaseLng === "number" ? body.businessBaseLng : Number(body.businessBaseLng);
        let baseLabel = businessBaseAddress ?? "";
        if (!Number.isFinite(baseLat) || !Number.isFinite(baseLng)) {
          if (!businessBaseAddress) {
            businessBase = { error: BUSINESS_BASE_GEOCODE_ERROR };
          } else {
            const geo = await geocodeBusinessBase(businessBaseAddress);
            baseLat = geo.lat;
            baseLng = geo.lng;
            baseLabel = geo.label;
          }
        }
        if (!businessBase) {
          businessBase = { lat: baseLat, lng: baseLng, label: baseLabel };
        }
      } catch {
        businessBase = { error: BUSINESS_BASE_GEOCODE_ERROR };
      }
    }

    const job = await dispatchFeatureJob({
      jobType: "maps_difficulty_run",
      payload: {
        keyword,
        lat,
        lng,
        label,
        service: body.service?.trim() || undefined,
        organizationId: auth.organizationId,
        address,
        businessBaseAddress: businessBaseAddress ?? null,
        businessBase,
      },
      organizationId: auth.organizationId,
      idempotencyKey: `maps-kd:${auth.organizationId}:${keyword}:${lat.toFixed(5)}:${lng.toFixed(5)}:${Math.floor(Date.now() / 60_000)}`,
      priority: "normal",
      maxAttempts: 2,
    });

    if (job.enqueueState === "enqueue_failed") {
      return NextResponse.json(
        { error: "Failed to queue Maps Difficulty run", jobId: job.jobId },
        { status: 503 }
      );
    }

    return NextResponse.json({
      queued: true,
      status: "queued",
      jobId: job.jobId,
      queueDriver: job.driver,
      keyword,
      lat,
      lng,
      label,
    });
  } catch (err) {
    return httpErrorFromException(err, "Maps difficulty failed");
  }
}
