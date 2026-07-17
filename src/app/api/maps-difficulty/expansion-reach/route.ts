import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireAuth } from "@/lib/auth/context";
import { requireInternalMapsDifficulty } from "@/lib/auth/plan-guards";
import { BUSINESS_BASE_GEOCODE_ERROR, geocodeBusinessBase } from "@/lib/maps-difficulty/geocode";
import {
  computeExpansionReach,
  competitorsFromKdResult,
  type ExpansionReachResult,
} from "@/lib/maps-difficulty/expansion-reach";
import type { MapsDifficultyResult } from "@/lib/maps-difficulty/enrich";
import { updateRunExpansion } from "@/lib/maps-difficulty/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lightweight Expansion Reach recalc — reuses an existing KD result.
 * Only geocodes the business base (minimal cost).
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    await requireInternalMapsDifficulty(auth.organizationId);
    const body = (await request.json()) as {
      runId?: string;
      businessBaseAddress?: string;
      businessBaseLat?: number;
      businessBaseLng?: number;
      businessBaseLabel?: string;
      kdResult?: MapsDifficultyResult;
    };

    const businessBaseAddress = body.businessBaseAddress?.trim();
    if (!businessBaseAddress && (body.businessBaseLat == null || body.businessBaseLng == null)) {
      return NextResponse.json({ error: "businessBaseAddress is required" }, { status: 400 });
    }

    const kd = body.kdResult;
    if (!kd?.score || !kd.searchPoint || !kd.score.top3Summary?.length) {
      return NextResponse.json(
        { error: "Expansion Reach needs an existing Maps KD result with top-3 distance data." },
        { status: 400 }
      );
    }

    let baseLat = typeof body.businessBaseLat === "number" ? body.businessBaseLat : Number(body.businessBaseLat);
    let baseLng = typeof body.businessBaseLng === "number" ? body.businessBaseLng : Number(body.businessBaseLng);
    let baseLabel = body.businessBaseLabel?.trim() || businessBaseAddress || "";

    if (!Number.isFinite(baseLat) || !Number.isFinite(baseLng)) {
      if (!businessBaseAddress) {
        return NextResponse.json({ error: BUSINESS_BASE_GEOCODE_ERROR }, { status: 400 });
      }
      const geo = await geocodeBusinessBase(businessBaseAddress);
      baseLat = geo.lat;
      baseLng = geo.lng;
      if (!baseLabel) baseLabel = geo.label;
    }

    const competitors = competitorsFromKdResult(kd.score.top3Summary);
    if (competitors.length === 0) {
      return NextResponse.json(
        { error: "Expansion Reach needs competitor distance data. Run a fresh Maps KD check for this keyword/location." },
        { status: 400 }
      );
    }

    const expansionReach: ExpansionReachResult = computeExpansionReach({
      mapsKeywordDifficulty: kd.score.mapsKeywordDifficulty,
      targetLocationLabel: kd.cityLabel,
      searchPoint: kd.searchPoint,
      businessBaseInput: businessBaseAddress ?? baseLabel,
      businessBaseLabel: baseLabel,
      businessBaseLat: baseLat,
      businessBaseLng: baseLng,
      competitors,
    });

    if (body.runId) {
      const updated = await updateRunExpansion({
        runId: body.runId,
        organizationId: auth.organizationId,
        businessBaseAddress: businessBaseAddress ?? baseLabel,
        expansionReach,
      });
      if (!updated) {
        return NextResponse.json({ error: "Run not found" }, { status: 404 });
      }
    }

    return NextResponse.json({ expansionReach, kdResult: kd });
  } catch (err) {
    return httpErrorFromException(err, "Expansion Reach calculation failed");
  }
}
