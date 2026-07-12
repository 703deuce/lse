import type { StoredCompetitor } from "@/lib/maps/grid-entity";
import { entityKeyFromParts } from "@/lib/maps/grid-entity";

export type ResolvedCompetitor = {
  competitorId: string | null;
  entityKey: string;
  name: string;
  cid?: string | null;
  place_id?: string | null;
  website_url?: string | null;
  phone?: string | null;
  lat?: number | null;
  lng?: number | null;
  isTracked: boolean;
  limitedData: boolean;
};

export function entityKeyFromRawResult(raw: StoredCompetitor): string {
  return entityKeyFromParts({
    cid: raw.cid,
    place_id: raw.place_id,
    name: raw.name,
  });
}

export function rawResultToProfile(raw: StoredCompetitor) {
  return {
    name: raw.name ?? "Unknown business",
    rank: raw.rank,
    cid: raw.cid,
    place_id: raw.place_id,
    rating: raw.rating,
    review_count: raw.review_count,
    category: raw.category,
    address: raw.address,
    phone: raw.phone,
    url: raw.url,
    lat: raw.lat,
    lng: raw.lng,
  };
}

export function normalizeDomain(url?: string | null): string | null {
  if (!url?.trim()) return null;
  try {
    const host = new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
    return host.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}
