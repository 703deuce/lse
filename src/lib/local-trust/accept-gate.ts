import type { FetchedOpportunityPage } from "@/lib/local-trust/fetch-opportunity-page";
import type { LocalTrustOpportunity, OpportunityDisplayGroup, OpportunityType } from "@/lib/local-trust/types";

export const MIN_VERIFY_CONFIDENCE = 80;
export const MIN_VERIFY_LOCAL_RELEVANCE = 75;
export const MIN_HIGH_PRIORITY_CONFIDENCE = 85;
export const MIN_HIGH_PRIORITY_LOCAL_RELEVANCE = 80;

const OTHER_STATE_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bwoodbridge\s*,?\s*nj\b|\bwoodbridge\s+new\s+jersey\b|\bperth\s+amboy\b/i, label: "New Jersey" },
  { pattern: /\bbridgeville\s*,?\s*de\b|\bwoodbridge\s*,?\s*de\b|\bwoodbridge\s+delaware\b/i, label: "Delaware" },
  { pattern: /\bwoodbridge\s*,?\s*ct\b|\bwoodbridge\s+connecticut\b/i, label: "Connecticut" },
  { pattern: /\bwoodbridge\s*,?\s*on\b|\bwoodbridge\s+ontario\b/i, label: "Ontario" },
  { pattern: /\bwoodbridge\s*,?\s*uk\b|\bwoodbridge\s+suffolk\b/i, label: "United Kingdom" },
];

const PLATFORM_DOMAINS = /^(www\.)?(eventeny|meetup|eventbrite)\.com$/i;

const OUT_OF_MARKET_RE =
  /out of market|out-of-market|wrong (city|state|location|market)|not (the\s+)?target|different woodbridge|another woodbridge|serves a different|not woodbridge,\s*va/i;

export type HardGateInput = {
  llmInclude: boolean;
  confidence: number;
  localRelevance: number;
  rejectReason?: string | null;
  reason?: string;
  locationMismatch?: boolean;
  domain: string;
  page: FetchedOpportunityPage;
  targetCity: string;
  targetState: string;
  targetCounty: string;
  opportunityType?: OpportunityType;
};

export type HardGateResult = {
  include: boolean;
  rejectReason?: string;
};

export function applyHardAcceptanceGates(input: HardGateInput): HardGateResult {
  const combinedText = [
    input.reason ?? "",
    input.rejectReason ?? "",
    input.page.title ?? "",
    input.page.bodyText,
    input.page.headings.join(" "),
  ].join(" ");

  if (input.rejectReason?.trim()) {
    return { include: false, rejectReason: input.rejectReason.trim() };
  }

  if (input.locationMismatch) {
    return { include: false, rejectReason: "Location mismatch — city/state does not match target market" };
  }

  if (OUT_OF_MARKET_RE.test(combinedText)) {
    return { include: false, rejectReason: "Out of market — verifier or page content indicates wrong location" };
  }

  const wrongState = detectConflictingState(combinedText, input.targetState);
  if (wrongState) {
    return {
      include: false,
      rejectReason: `Wrong location — page references ${wrongState}, target is ${input.targetState}`,
    };
  }

  const cityCollision = detectCityNameCollision(input.targetCity, input.targetState, input.targetCounty, combinedText);
  if (cityCollision) {
    return { include: false, rejectReason: cityCollision };
  }

  if (isPlatformListingPage(input.domain, input.page)) {
    return {
      include: false,
      rejectReason: "Platform or aggregator listing — not an official organization opportunity page",
    };
  }

  if (isGenericCountyResource(input.page.url, input.page.title ?? "", input.page.bodyText, input.opportunityType)) {
    return {
      include: false,
      rejectReason: "Generic county resource page — keep only direct vendor/procurement opportunities",
    };
  }

  if (
    !input.llmInclude ||
    input.confidence < MIN_VERIFY_CONFIDENCE ||
    input.localRelevance < MIN_VERIFY_LOCAL_RELEVANCE
  ) {
    return {
      include: false,
      rejectReason:
        input.llmInclude === false
          ? "LLM marked as not a valid opportunity"
          : `Below thresholds (confidence ${input.confidence}, local relevance ${input.localRelevance})`,
    };
  }

  return { include: true };
}

export function isHighPriorityVerified(confidence: number, localRelevance: number): boolean {
  return confidence >= MIN_HIGH_PRIORITY_CONFIDENCE && localRelevance >= MIN_HIGH_PRIORITY_LOCAL_RELEVANCE;
}

function detectConflictingState(text: string, targetState: string): string | null {
  const target = targetState.trim().toUpperCase();
  if (!target) return null;

  for (const { pattern, label } of OTHER_STATE_PATTERNS) {
    if (pattern.test(text)) {
      return label;
    }
  }

  if (target === "VA") {
    if (/\bwoodbridge\s*,?\s*nj\b|\bperth\s+amboy\b|\b,\s*nj\b(?=\s*\d{5})?/i.test(text)) {
      return "New Jersey";
    }
    if (/\bbridgeville\b|\bwoodbridge\s*,?\s*de\b/i.test(text)) {
      return "Delaware";
    }
  }

  return null;
}

function detectCityNameCollision(
  targetCity: string,
  targetState: string,
  targetCounty: string,
  text: string
): string | null {
  const city = targetCity.trim().toLowerCase();
  if (city.length < 4) return null;

  const hasTargetMarket =
    new RegExp(`\\b${escapeRegex(city)}\\s*,?\\s*${targetState}\\b`, "i").test(text) ||
    (targetCounty && new RegExp(escapeRegex(targetCounty.replace(/\s+county/i, "")), "i").test(text)) ||
    /\bprince william county\b/i.test(text);

  if (!text.toLowerCase().includes(city)) return null;
  if (hasTargetMarket) return null;

  for (const { pattern, label } of OTHER_STATE_PATTERNS) {
    if (pattern.test(text)) {
      return `City name collision — "${targetCity}" match is actually ${label}, not ${targetState}`;
    }
  }

  return null;
}

export function isPlatformListingPage(domain: string, page: FetchedOpportunityPage): boolean {
  const d = domain.toLowerCase().replace(/^www\./, "");
  if (PLATFORM_DOMAINS.test(d)) return true;

  if (/^patch\.com$/i.test(d)) {
    const hay = `${page.title ?? ""} ${page.bodyText}`;
    const hasActiveSponsorPath =
      /sponsor(ship)?\s*(level|tier|package|opportunit|info)|become a sponsor|sponsor\s+contact|current sponsor/i.test(
        hay
      );
    return !hasActiveSponsorPath;
  }

  if (/^meetup\.com$/i.test(d)) return true;

  if (/^runsignup\.com$/i.test(d)) {
    const hay = `${page.title ?? ""} ${page.bodyText}`;
    return !/sponsor(ship)?|become a sponsor|sponsor\s+level/i.test(hay);
  }

  return false;
}

function isGenericCountyResource(
  url: string,
  title: string,
  pageText: string,
  opportunityType?: OpportunityType
): boolean {
  if (opportunityType !== "city_county") return false;
  const hay = `${title} ${url} ${pageText}`.toLowerCase();
  if (/procurement|vendor\s+regist|become a vendor|supplier\s+portal|bid\s+opportunit|doing business with/i.test(hay)) {
    return false;
  }
  return /economic development|department of development|business resource|entrepreneur|startup|tourism|visit\s+\w+\s+county|government directory|departments and services/i.test(
    hay
  );
}

export function resolveDisplayGroup(opp: {
  opportunityType: OpportunityType;
  url: string;
  title: string;
  domain: string;
}): OpportunityDisplayGroup {
  const hay = `${opp.title} ${opp.url} ${opp.domain}`.toLowerCase();

  if (
    opp.opportunityType === "vendor_list" ||
    (opp.opportunityType === "city_county" && /procurement|vendor|supplier|bid/i.test(hay))
  ) {
    return "vendor_registration";
  }

  if (opp.opportunityType === "cleanup_event" || (opp.opportunityType === "industry_local" && /green|environment|beautiful|recycl/i.test(hay))) {
    return "cleanup_environmental";
  }

  if (
    opp.opportunityType === "school_sponsor" ||
    (opp.opportunityType === "community_event" && /sponsor|5k|run|walk|league|fundrais/i.test(hay))
  ) {
    return "local_sponsorship";
  }

  if (opp.opportunityType === "chamber" || opp.opportunityType === "charity" || /rotary|chamber|civic/i.test(hay)) {
    return "civic_membership";
  }

  if (opp.opportunityType === "community_event") {
    return "local_sponsorship";
  }

  if (opp.opportunityType === "city_county") {
    return "vendor_registration";
  }

  return "civic_membership";
}

function normalizeOrgKey(title: string, domain: string, opportunityType: OpportunityType): string {
  const normalized = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const d = domain.toLowerCase().replace(/^www\./, "");

  if (/prince william.*chamber|pw\s*chamber/i.test(normalized + d)) {
    return "org:prince-william-chamber";
  }
  if (/woodbridge.*rotary|rotary.*woodbridge/i.test(normalized) && !/perth amboy|new jersey|\bnj\b/i.test(normalized + d)) {
    return "org:woodbridge-rotary-va";
  }
  if (/lake ridge.*rotary|rotary.*lake ridge/i.test(normalized)) {
    return "org:lake-ridge-rotary";
  }
  if (/woodbridge.*little league|little league.*woodbridge/i.test(normalized) && /\.(org|com)$/i.test(d)) {
    if (!/delaware|\bde\b|bridgeville/i.test(normalized + d)) {
      return `org:woodbridge-little-league:${d}`;
    }
  }
  if (/keep prince william beautiful|kpwb/i.test(normalized + d)) {
    return "org:kpwb";
  }
  if (/tunnel to towers/i.test(normalized)) {
    return "org:tunnel-to-towers-pwc";
  }

  if (opportunityType === "chamber" || /chamber|rotary/i.test(normalized)) {
    const slug = normalized.replace(/\b(the|of|va|virginia|inc|club)\b/g, "").trim().slice(0, 60);
    return `org:${slug || d}`;
  }

  return `domain:${d}`;
}

export function dedupeOpportunities(opportunities: LocalTrustOpportunity[]): LocalTrustOpportunity[] {
  const byKey = new Map<string, LocalTrustOpportunity>();

  for (const opp of opportunities) {
    const verification = opp.raw?.verification as Record<string, unknown> | undefined;
    const orgName =
      (typeof verification?.organizationName === "string" ? verification.organizationName : null) ?? opp.title;
    const key = normalizeOrgKey(orgName, opp.domain, opp.opportunityType);
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, opp);
      continue;
    }

    const existingUrls = new Set<string>([
      existing.url,
      ...(((existing.raw.alternateUrls as string[] | undefined) ?? [])),
    ]);
    existingUrls.add(opp.url);

    const winner = opp.relevanceScore > existing.relevanceScore ? { ...opp } : { ...existing };
    const loser = winner.url === opp.url ? existing : opp;

    winner.raw = {
      ...winner.raw,
      alternateUrls: [...existingUrls].filter((u) => u !== winner.url),
      mergedFrom: [
        ...((winner.raw.mergedFrom as string[] | undefined) ?? []),
        loser.url,
      ],
    };

    byKey.set(key, winner);
  }

  return [...byKey.values()].sort((a, b) => b.relevanceScore - a.relevanceScore);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
