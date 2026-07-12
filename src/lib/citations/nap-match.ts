export type NapStatus = "match" | "partial" | "mismatch" | "missing_data" | "unverified";

const SUFFIXES = /\b(llc|l\.l\.c\.|inc|incorporated|co|company|corp|corporation|ltd)\b/gi;

const STREET_ABBREV: Record<string, string> = {
  street: "st",
  st: "st",
  road: "rd",
  rd: "rd",
  avenue: "ave",
  ave: "ave",
  drive: "dr",
  dr: "dr",
  court: "ct",
  ct: "ct",
  lane: "ln",
  ln: "ln",
  boulevard: "blvd",
  blvd: "blvd",
  suite: "ste",
  ste: "ste",
  apartment: "apt",
  apt: "apt",
};

export function normalizeName(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(SUFFIXES, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function nameMatchScore(a: string | null | undefined, b: string | null | undefined): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 100;
  if (na.includes(nb) || nb.includes(na)) return 90;
  const tokensA = na.split(" ").filter((t) => t.length > 2);
  const tokensB = new Set(nb.split(" ").filter((t) => t.length > 2));
  if (!tokensA.length) return 0;
  const matched = tokensA.filter((t) => tokensB.has(t)).length;
  return Math.round((matched / tokensA.length) * 100);
}

export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length >= 10) return digits.slice(-10);
  return digits.length >= 7 ? digits : null;
}

export function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const pa = normalizePhone(a);
  const pb = normalizePhone(b);
  return !!(pa && pb && pa === pb);
}

export function rootDomain(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    const host = new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
    return host.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

export function domainsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const da = rootDomain(a);
  const db = rootDomain(b);
  if (!da || !db) return false;
  return da === db || da.endsWith(`.${db}`) || db.endsWith(`.${da}`);
}

export function normalizeAddress(address: string | null | undefined): string {
  if (!address) return "";
  let s = address.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  for (const [from, to] of Object.entries(STREET_ABBREV)) {
    s = s.replace(new RegExp(`\\b${from}\\b`, "g"), to);
  }
  return s.replace(/\s+/g, " ").trim();
}

export function addressMatchScore(a: string | null | undefined, b: string | null | undefined): number {
  const na = normalizeAddress(a);
  const nb = normalizeAddress(b);
  if (!na || !nb) return 0;
  if (na === nb) return 100;
  if (na.includes(nb) || nb.includes(na)) return 85;
  const zipA = na.match(/\b\d{5}\b/)?.[0];
  const zipB = nb.match(/\b\d{5}\b/)?.[0];
  if (zipA && zipB && zipA === zipB) {
    const streetA = na.replace(zipA, "").trim();
    const streetB = nb.replace(zipB, "").trim();
    if (streetA && streetB && (streetA.includes(streetB) || streetB.includes(streetA))) return 75;
  }
  const tokensA = na.split(" ").filter((t) => t.length > 2);
  const tokensB = new Set(nb.split(" ").filter((t) => t.length > 2));
  if (!tokensA.length) return 0;
  const matched = tokensA.filter((t) => tokensB.has(t)).length;
  return Math.round((matched / tokensA.length) * 100);
}

export function classifyNapStatus(params: {
  nameScore: number;
  addressScore: number;
  phoneMatch: boolean;
  websiteMatch: boolean;
  hasParsedData: boolean;
  verified: boolean;
}): NapStatus {
  if (!params.verified) return "unverified";
  if (!params.hasParsedData) return "missing_data";

  const phoneOk = params.phoneMatch;
  const webOk = params.websiteMatch;
  const nameOk = params.nameScore >= 70;
  const addrOk = params.addressScore >= 60;

  if (phoneOk && webOk && nameOk && addrOk) return "match";
  if ((phoneOk || webOk) && (nameOk || addrOk)) return "partial";
  if (!phoneOk && !webOk && params.nameScore < 40 && params.addressScore < 40) return "missing_data";
  return "mismatch";
}

export type NapIssue = {
  source: string;
  issueType: string;
  expected: string;
  found: string;
  severity: "high" | "medium" | "low";
  fixRecommendation: string;
};

export function detectNapIssues(listing: {
  source_name: string;
  expected_name?: string | null;
  expected_address?: string | null;
  expected_phone?: string | null;
  expected_website?: string | null;
  name_found?: string | null;
  address_found?: string | null;
  phone_found?: string | null;
  website_found?: string | null;
  name_match_score?: number | null;
  address_match_score?: number | null;
  phone_match_score?: number | null;
  website_match_score?: number | null;
  nap_status: string;
}): NapIssue[] {
  const issues: NapIssue[] = [];
  const src = listing.source_name;

  if (listing.nap_status === "unverified" || listing.nap_status === "missing_data") return issues;

  if (listing.expected_name && listing.name_found && (listing.name_match_score ?? 0) < 70) {
    issues.push({
      source: src,
      issueType: "Name mismatch",
      expected: listing.expected_name,
      found: listing.name_found,
      severity: "medium",
      fixRecommendation: `Update the business name on ${src} to match your GBP exactly.`,
    });
  }

  if (listing.expected_address && !listing.address_found) {
    issues.push({
      source: src,
      issueType: "Missing address",
      expected: listing.expected_address,
      found: "—",
      severity: "high",
      fixRecommendation: `Add your full address to the ${src} listing.`,
    });
  } else if (listing.expected_address && listing.address_found && (listing.address_match_score ?? 0) < 60) {
    issues.push({
      source: src,
      issueType: "Address mismatch",
      expected: listing.expected_address,
      found: listing.address_found,
      severity: "high",
      fixRecommendation: `Correct the address on ${src} to match your Google Business Profile.`,
    });
  }

  if (listing.expected_phone && !listing.phone_found) {
    issues.push({
      source: src,
      issueType: "Missing phone",
      expected: listing.expected_phone,
      found: "—",
      severity: "high",
      fixRecommendation: `Add your phone number to the ${src} listing.`,
    });
  } else if (
    listing.expected_phone &&
    listing.phone_found &&
    !phonesMatch(listing.expected_phone, listing.phone_found)
  ) {
    issues.push({
      source: src,
      issueType: "Phone mismatch",
      expected: listing.expected_phone,
      found: listing.phone_found,
      severity: "high",
      fixRecommendation: `Use the same phone format everywhere — update ${src}.`,
    });
  }

  if (listing.expected_website && listing.website_found && !domainsMatch(listing.expected_website, listing.website_found)) {
    issues.push({
      source: src,
      issueType: "Wrong domain",
      expected: rootDomain(listing.expected_website) ?? listing.expected_website,
      found: rootDomain(listing.website_found) ?? listing.website_found,
      severity: "medium",
      fixRecommendation: `Point the website link on ${src} to your official domain.`,
    });
  }

  return issues;
}
