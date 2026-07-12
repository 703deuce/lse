import type { OpportunityType } from "@/lib/local-trust/types";

const TYPE_RULES: Array<{ type: OpportunityType; patterns: RegExp[] }> = [
  { type: "chamber", patterns: [/chamber\s+of\s+commerce/i, /business\s+association/i, /rotary/i, /bni\b/i] },
  { type: "local_directory", patterns: [/business\s+directory/i, /member\s+directory/i, /local\s+directory/i, /find\s+a\s+business/i] },
  { type: "local_news", patterns: [/news/i, /gazette/i, /herald/i, /tribune/i, /patch\.com/i, /blog/i, /times/i] },
  { type: "community_event", patterns: [/community\s+event/i, /festival/i, /fair\s+sponsor/i, /event\s+sponsor/i] },
  { type: "charity", patterns: [/charity/i, /nonprofit/i, /non-profit/i, /foundation/i, /donate/i] },
  { type: "school_sponsor", patterns: [/school/i, /little\s+league/i, /youth\s+sports/i, /pta/i, /booster/i, /team\s+sponsor/i] },
  { type: "hoa_vendor", patterns: [/hoa/i, /homeowners/i, /neighborhood/i, /vendor\s+list/i, /approved\s+vendor/i] },
  { type: "city_county", patterns: [/\.gov/i, /city\s+of/i, /county/i, /municipal/i, /government/i] },
  { type: "vendor_list", patterns: [/vendor/i, /resource\s+list/i, /preferred\s+provider/i, /contractor\s+list/i] },
  { type: "cleanup_event", patterns: [/cleanup/i, /recycling/i, /waste/i, /dump/i, /haul/i] },
  { type: "industry_local", patterns: [/home\s+services/i, /junk\s+removal/i, /hauling/i, /disposal/i] },
];

export function classifyOpportunity(hit: {
  title: string;
  url: string;
  description?: string;
  domain: string;
}): OpportunityType {
  const hay = `${hit.title} ${hit.url} ${hit.description ?? ""} ${hit.domain}`;
  for (const rule of TYPE_RULES) {
    if (rule.patterns.some((p) => p.test(hay))) return rule.type;
  }
  return "other";
}

export function suggestedActionForType(type: OpportunityType): string {
  const actions: Record<OpportunityType, string> = {
    chamber: "Join chamber and list your business in the member directory",
    local_directory: "Submit or claim your business listing",
    local_news: "Pitch a local story or sponsor community coverage",
    community_event: "Sponsor or participate in the community event",
    charity: "Partner with the charity for sponsorship or in-kind hauling",
    school_sponsor: "Sponsor a team or school program page",
    hoa_vendor: "Request inclusion on the HOA approved vendor list",
    city_county: "Explore official directory or vendor registration",
    vendor_list: "Apply to be listed as an approved vendor",
    cleanup_event: "Offer junk hauling support for the cleanup event",
    industry_local: "Get listed on this local industry resource page",
    other: "Review page and pursue a local mention or listing",
  };
  return actions[type];
}

export function difficultyForType(type: OpportunityType): "easy" | "medium" | "hard" {
  if (type === "local_directory" || type === "chamber" || type === "vendor_list") return "easy";
  if (type === "local_news" || type === "charity") return "hard";
  return "medium";
}

export function authorityScoreForDomain(domain: string, type: OpportunityType): number {
  let score = 40;
  if (/\.gov$/i.test(domain) || domain.includes(".gov.")) score += 35;
  if (/\.org$/i.test(domain)) score += 20;
  if (/chamber|commerce|rotary/i.test(domain)) score += 25;
  if (/facebook|yelp|linkedin|instagram|twitter|x\.com/i.test(domain)) score -= 30;
  if (type === "city_county") score += 15;
  if (type === "chamber") score += 10;
  return Math.max(0, Math.min(100, score));
}
