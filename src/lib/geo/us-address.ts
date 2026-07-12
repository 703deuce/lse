const US_STATE_NAMES: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
  DC: "District of Columbia",
};

const FULL_STATE_PATTERN = Object.values(US_STATE_NAMES).join("|");

/** Parse city + state from a US Google Maps / GMB address string. */
export function parseUsAddressCityState(address: string | null | undefined): {
  city: string | null;
  state: string | null;
} {
  if (!address?.trim()) return { city: null, state: null };
  const addr = address.trim();

  // "123 Main St, Woodbridge, VA 22191, United States"
  const abbr = addr.match(/,\s*([^,]+?),\s*([A-Z]{2})\s*(?:\d{5}(?:-\d{4})?)?(?:\s*,|\s*$)/i);
  if (abbr) {
    return { city: abbr[1].trim(), state: abbr[2].trim().toUpperCase() };
  }

  // "123 Main St, Woodbridge, Virginia 22191"
  const full = new RegExp(
    `,\\s*([^,]+?),\\s*(${FULL_STATE_PATTERN})\\s*(?:\\d{5}(?:-\\d{4})?)?(?:\\s*,|\\s*$)`,
    "i"
  );
  const fullMatch = addr.match(full);
  if (fullMatch) {
    const stateName = fullMatch[2].trim();
    const abbrKey = Object.entries(US_STATE_NAMES).find(
      ([, name]) => name.toLowerCase() === stateName.toLowerCase()
    )?.[0];
    return { city: fullMatch[1].trim(), state: abbrKey ?? stateName };
  }

  // "Woodbridge, VA" or "Woodbridge, Virginia"
  const shortAbbr = addr.match(/^([^,]+),\s*([A-Z]{2})\b/i);
  if (shortAbbr) {
    return { city: shortAbbr[1].trim(), state: shortAbbr[2].trim().toUpperCase() };
  }

  const shortFull = new RegExp(`^([^,]+),\\s*(${FULL_STATE_PATTERN})\\b`, "i");
  const shortFullMatch = addr.match(shortFull);
  if (shortFullMatch) {
    const stateName = shortFullMatch[2].trim();
    const abbrKey = Object.entries(US_STATE_NAMES).find(
      ([, name]) => name.toLowerCase() === stateName.toLowerCase()
    )?.[0];
    return { city: shortFullMatch[1].trim(), state: abbrKey ?? stateName };
  }

  return { city: null, state: null };
}

/** ScrapingDog recommends city-level origin, e.g. "Woodbridge, Virginia". */
export function formatSearchLocation(city: string, state: string): string {
  const st = state.trim().toUpperCase();
  const stateLabel = US_STATE_NAMES[st] ?? state.trim();
  return `${city.trim()}, ${stateLabel}`;
}
