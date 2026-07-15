import { runMapsDifficulty } from "@/lib/maps-difficulty/enrich";
import {
  computeExpansionReach,
  competitorsFromKdResult,
} from "@/lib/maps-difficulty/expansion-reach";
import { BUSINESS_BASE_GEOCODE_ERROR } from "@/lib/maps-difficulty/geocode";
import { saveRun } from "@/lib/maps-difficulty/store";

export type MapsDifficultyJobInput = {
  organizationId: string;
  keyword: string;
  lat: number;
  lng: number;
  label: string;
  service?: string;
  address?: string | null;
  businessBase?: {
    lat?: number;
    lng?: number;
    label?: string;
    error?: string;
  } | null;
  businessBaseAddress?: string | null;
};

/**
 * Full Maps KD pipeline for queue workers — includes expansion reach + DB persist.
 */
export async function processMapsDifficultyJob(input: MapsDifficultyJobInput): Promise<{
  runId: string;
  mapsKeywordDifficulty: number;
}> {
  const result = await runMapsDifficulty({
    keyword: input.keyword,
    lat: input.lat,
    lng: input.lng,
    label: input.label,
    service: input.service,
  });

  let expansionReach = undefined;
  const base = input.businessBase;

  if (!base?.error && base && Number.isFinite(base.lat) && Number.isFinite(base.lng)) {
    const competitors = competitorsFromKdResult(result.score.top3Summary);
    if (competitors.length > 0) {
      expansionReach = computeExpansionReach({
        mapsKeywordDifficulty: result.score.mapsKeywordDifficulty,
        targetLocationLabel: result.cityLabel,
        searchPoint: result.searchPoint,
        businessBaseInput: input.businessBaseAddress ?? base.label ?? "",
        businessBaseLabel: base.label ?? "",
        businessBaseLat: Number(base.lat),
        businessBaseLng: Number(base.lng),
        competitors,
      });
    }
  } else if (base?.error && base.error !== BUSINESS_BASE_GEOCODE_ERROR) {
    // keep going — expansion optional
  }

  const id = await saveRun({
    organizationId: input.organizationId ?? null,
    address: input.address ?? null,
    businessBaseAddress: input.businessBaseAddress ?? null,
    result,
    expansionReach,
  });

  return {
    runId: id ?? "",
    mapsKeywordDifficulty: result.score.mapsKeywordDifficulty,
  };
}
