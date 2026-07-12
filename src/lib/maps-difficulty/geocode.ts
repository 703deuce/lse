/**
 * Address / city+state -> lat/lng geocoding via OpenStreetMap Nominatim.
 *
 * Users provide an address (or just "City, ST"); Google/OSM decides the exact
 * coordinates so the caller never has to know lat/lng. Nominatim is keyless but
 * requires a descriptive User-Agent and light rate limiting (fine for on-demand
 * single lookups).
 */

export interface GeocodeResult {
  lat: number;
  lng: number;
  label: string;
  displayName: string;
}

export const BUSINESS_BASE_GEOCODE_ERROR =
  "Could not resolve that business base location. Try entering a full address or city/state.";

/** Geocode a business base for Expansion Reach — uses friendly error copy on failure. */
export async function geocodeBusinessBase(address: string): Promise<GeocodeResult> {
  try {
    return await geocodeAddress(address);
  } catch {
    throw new Error(BUSINESS_BASE_GEOCODE_ERROR);
  }
}

export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  const q = address.trim();
  if (!q) throw new Error("Address is required");

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", "us");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  let data: Array<{
    lat?: string;
    lon?: string;
    display_name?: string;
    address?: Record<string, string>;
  }>;
  try {
    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "MapsGrowthAgent/1.0 (maps keyword difficulty tool)",
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Geocoder HTTP ${res.status}`);
    data = await res.json();
  } finally {
    clearTimeout(timer);
  }

  const hit = data?.[0];
  const lat = Number(hit?.lat);
  const lng = Number(hit?.lon);
  if (!hit || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error(`Could not find coordinates for "${q}"`);
  }

  // Prefer a compact "City, ST" label for display; fall back to the raw query.
  const a = hit.address ?? {};
  const city = a.city ?? a.town ?? a.village ?? a.hamlet ?? a.county ?? null;
  const state = a.state ?? null;
  const stateAbbr = state ? US_STATE_ABBR[state] ?? state : null;
  const label = city && stateAbbr ? `${city}, ${stateAbbr}` : city ?? q;

  return { lat, lng, label, displayName: hit.display_name ?? q };
}

const US_STATE_ABBR: Record<string, string> = {
  Alabama: "AL",
  Alaska: "AK",
  Arizona: "AZ",
  Arkansas: "AR",
  California: "CA",
  Colorado: "CO",
  Connecticut: "CT",
  Delaware: "DE",
  Florida: "FL",
  Georgia: "GA",
  Hawaii: "HI",
  Idaho: "ID",
  Illinois: "IL",
  Indiana: "IN",
  Iowa: "IA",
  Kansas: "KS",
  Kentucky: "KY",
  Louisiana: "LA",
  Maine: "ME",
  Maryland: "MD",
  Massachusetts: "MA",
  Michigan: "MI",
  Minnesota: "MN",
  Mississippi: "MS",
  Missouri: "MO",
  Montana: "MT",
  Nebraska: "NE",
  Nevada: "NV",
  "New Hampshire": "NH",
  "New Jersey": "NJ",
  "New Mexico": "NM",
  "New York": "NY",
  "North Carolina": "NC",
  "North Dakota": "ND",
  Ohio: "OH",
  Oklahoma: "OK",
  Oregon: "OR",
  Pennsylvania: "PA",
  "Rhode Island": "RI",
  "South Carolina": "SC",
  "South Dakota": "SD",
  Tennessee: "TN",
  Texas: "TX",
  Utah: "UT",
  Vermont: "VT",
  Virginia: "VA",
  Washington: "WA",
  "West Virginia": "WV",
  Wisconsin: "WI",
  Wyoming: "WY",
  "District of Columbia": "DC",
};
