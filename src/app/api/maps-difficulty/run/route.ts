import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { runMapsDifficulty } from "@/lib/maps-difficulty/enrich";
import { BUSINESS_BASE_GEOCODE_ERROR, geocodeAddress, geocodeBusinessBase } from "@/lib/maps-difficulty/geocode";
import { saveRun } from "@/lib/maps-difficulty/store";
import {
  computeExpansionReach,
  competitorsFromKdResult,
} from "@/lib/maps-difficulty/expansion-reach";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();

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

    const result = await runMapsDifficulty({
      keyword,
      lat,
      lng,
      label,
      service: body.service?.trim() || undefined,
    });

    let expansionReach = undefined;
    let expansionError: string | undefined;
    const businessBaseAddress = body.businessBaseAddress?.trim();
    if (businessBaseAddress || (body.businessBaseLat != null && body.businessBaseLng != null)) {
      try {
        let baseLat = typeof body.businessBaseLat === "number" ? body.businessBaseLat : Number(body.businessBaseLat);
        let baseLng = typeof body.businessBaseLng === "number" ? body.businessBaseLng : Number(body.businessBaseLng);
        let baseLabel = businessBaseAddress ?? "";

        if (!Number.isFinite(baseLat) || !Number.isFinite(baseLng)) {
          if (!businessBaseAddress) {
            expansionError = BUSINESS_BASE_GEOCODE_ERROR;
          } else {
            const geo = await geocodeBusinessBase(businessBaseAddress);
            baseLat = geo.lat;
            baseLng = geo.lng;
            baseLabel = geo.label;
          }
        }

        if (!expansionError) {
          const competitors = competitorsFromKdResult(result.score.top3Summary);
          if (competitors.length === 0) {
            return NextResponse.json(
              { error: "Not enough Maps results were found to calculate Expansion Reach." },
              { status: 400 }
            );
          }

          expansionReach = computeExpansionReach({
            mapsKeywordDifficulty: result.score.mapsKeywordDifficulty,
            targetLocationLabel: result.cityLabel,
            searchPoint: result.searchPoint,
            businessBaseInput: businessBaseAddress ?? baseLabel,
            businessBaseLabel: baseLabel,
            businessBaseLat: baseLat,
            businessBaseLng: baseLng,
            competitors,
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        if (message === BUSINESS_BASE_GEOCODE_ERROR) {
          expansionError = message;
        } else {
          throw err;
        }
      }
    }

    const id = await saveRun({
      organizationId: auth.organizationId ?? null,
      address,
      businessBaseAddress: businessBaseAddress ?? null,
      result,
      expansionReach,
    });

    return NextResponse.json({ ...result, expansionReach, expansionError, id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Maps difficulty run failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
