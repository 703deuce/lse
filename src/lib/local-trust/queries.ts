export function extractCountyFromAddress(address: string | null | undefined): string | null {
  if (!address) return null;
  const m = address.match(/([A-Za-z\s]+)\s+County/i);
  if (m) return `${m[1].trim()} County`;
  return null;
}

/** Infer county from city for common query templates when address lacks county. */
const CITY_COUNTY_HINTS: Record<string, string> = {
  woodbridge: "Prince William County",
  "dale city": "Prince William County",
  "lake ridge": "Prince William County",
  chantilly: "Fairfax County",
  arlington: "Arlington County",
  alexandria: "Alexandria",
};

export function inferCounty(city: string | null, address?: string | null): string | null {
  const fromAddress = extractCountyFromAddress(address);
  if (fromAddress) return fromAddress;
  if (!city) return null;
  const key = city.trim().toLowerCase();
  return CITY_COUNTY_HINTS[key] ?? null;
}

export function buildLocalTrustQueries(params: {
  city: string;
  county: string | null;
  state: string;
  category: string;
  serviceKeyword?: string;
}): string[] {
  const { city, county, state } = params;
  const st = state.length === 2 ? state.toUpperCase() : state;
  const cat = params.category.trim();
  const svc = (params.serviceKeyword ?? cat).trim().toLowerCase();
  const countyLabel = county ?? `${city} area`;

  const queries = [
    `${city} ${st} chamber of commerce business directory`,
    `${countyLabel} chamber of commerce ${svc}`,
    `${city} ${st} local business directory`,
    `${city} ${st} sponsor page`,
    `${city} ${st} community event sponsors`,
    `${city} ${st} charity sponsors`,
    `${city} ${st} school sponsor`,
    `${city} ${st} little league sponsors`,
    `${countyLabel} home services directory`,
    `${city} ${st} local news ${svc}`,
    `${city} ${st} community cleanup sponsor`,
    `${countyLabel} recycling event sponsor`,
    `${city} ${st} HOA vendor list`,
    `${city} ${st} nonprofit partners ${svc}`,
    `${countyLabel} business association members`,
    `${city} ${st} vendor resource list`,
    `site:.gov ${city} ${st} business directory`,
    `${city} ${st} rotary club sponsors`,
  ];

  return [...new Set(queries.filter(Boolean))];
}
