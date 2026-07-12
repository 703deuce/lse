import type { OpportunityType } from "@/lib/local-trust/types";

export type FilterVerdict = "keep" | "reject";

export type RuleFilterResult = {
  verdict: FilterVerdict;
  reason: string;
};

const NATIONAL_DIRECTORY_DOMAINS = new Set([
  "homeadvisor.com",
  "angi.com",
  "angieslist.com",
  "thumbtack.com",
  "yelp.com",
  "m.yelp.com",
  "yellowpages.com",
  "superpages.com",
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "pinterest.com",
  "reddit.com",
  "twitter.com",
  "x.com",
  "nextdoor.com",
  "mapquest.com",
  "foursquare.com",
  "expertise.com",
  "threebestrated.com",
  "bark.com",
  "porch.com",
  "homestars.com",
  "trustpilot.com",
  "indeed.com",
  "glassdoor.com",
  "wikipedia.org",
  "en.wikipedia.org",
  "bizbuysell.com",
  "manta.com",
  "citybyapp.com",
  "chamberofcommerce.com",
  "chambermaster.com",
  "growthzoneapp.com",
  "causeiq.com",
  "enigma.com",
  "instrumentl.com",
  "charitynavigator.org",
]);

const SERVICE_COMPANY_DOMAIN_HINTS = [
  /junk/i,
  /haul/i,
  /removal/i,
  /dumpster/i,
  /disposal/i,
  /cleanout/i,
  /debris/i,
  /rubbish/i,
  /trash/i,
  /gotjunk/i,
  /loadup/i,
  /luggers/i,
];

const TRUST_SIGNALS =
  /chamber|directory|sponsor|cleanup|charity|nonprofit|non-profit|\.gov|member|vendor list|hoa|league|school|event|foundation|rotary|little league|approved vendor|resource guide|community partner|become a sponsor|sponsorship/i;

const SERVICE_PAGE_TITLE =
  /\b(junk\s+removal|junk\s+hauling|hauling\s+services|waste\s+material|dumpster|cleanouts?)\b.*\b(in|near|serving)\b|\|\s*(junk|haul|removal|hauling|disposal)/i;

const SERVICE_COMPANY_TITLE =
  /\b(services|care|handyman|contractors?|removal|hauling|cleanouts?|plumbing|hvac|landscaping)\b.*\b(in|near|serving)\b/i;

function isOtherServiceCompanyPage(hit: {
  title: string;
  url: string;
  domain: string;
  description?: string;
}): boolean {
  const hay = `${hit.title} ${hit.url} ${hit.description ?? ""}`;
  if (TRUST_SIGNALS.test(hay)) return false;
  if (/\.gov|chamber|rotary|foundation|littleleague|\.org/i.test(hit.domain + hay)) return false;
  if (SERVICE_COMPANY_TITLE.test(hit.title)) return true;
  if (/\|\s*[A-Z][\w\s&.]+$/i.test(hit.title) && !TRUST_SIGNALS.test(hay)) return true;
  return false;
}

function domainMatchesSet(domain: string, set: Set<string>): boolean {
  const d = domain.toLowerCase();
  if (set.has(d)) return true;
  return [...set].some((blocked) => d === blocked || d.endsWith(`.${blocked}`));
}

function isServiceCompanyDomain(domain: string): boolean {
  const d = domain.toLowerCase();
  return SERVICE_COMPANY_DOMAIN_HINTS.some((p) => p.test(d));
}

function isNationalDirectory(domain: string): boolean {
  return domainMatchesSet(domain, NATIONAL_DIRECTORY_DOMAINS);
}

function isSchoolHomepage(url: string, title: string, hay: string): boolean {
  if (!/\.edu\b|pwcs\.edu|k12\./i.test(url)) return false;
  return !/sponsor|donate|partner|vendor|community|booster|league/i.test(hay) && /home|school|academy|high school|middle school/i.test(title);
}

export function hasTrustSignals(text: string): boolean {
  return TRUST_SIGNALS.test(text);
}

export function ruleFilterOpportunity(hit: {
  title: string;
  url: string;
  domain: string;
  description?: string;
  opportunityType: OpportunityType;
}): RuleFilterResult {
  const hay = `${hit.title} ${hit.url} ${hit.description ?? ""} ${hit.domain}`;
  const domain = hit.domain.toLowerCase();

  if (isNationalDirectory(domain)) {
    return { verdict: "reject", reason: "National directory or aggregator — not a local trust opportunity" };
  }

  if (/^m\.yelp\.|^www\.yelp\./i.test(domain) || /yelp\.com$/i.test(domain)) {
    return { verdict: "reject", reason: "Yelp listing page" };
  }

  if (isServiceCompanyDomain(domain) && !TRUST_SIGNALS.test(hay)) {
    return { verdict: "reject", reason: "Service company website — not a listing or sponsorship page" };
  }

  if (SERVICE_PAGE_TITLE.test(hit.title) && !TRUST_SIGNALS.test(hay)) {
    return { verdict: "reject", reason: "Competitor or service company landing page" };
  }

  if (isOtherServiceCompanyPage(hit)) {
    return { verdict: "reject", reason: "Other local service company — not a trust or sponsorship opportunity" };
  }

  if (hit.opportunityType === "industry_local" && !TRUST_SIGNALS.test(hay)) {
    return { verdict: "reject", reason: "Industry service page without sponsorship or directory context" };
  }

  if (hit.opportunityType === "local_news" && !/sponsor|community|event|cleanup|donate|foundation|chamber/i.test(hay)) {
    return { verdict: "reject", reason: "News homepage or article — not a sponsorship opportunity" };
  }

  if (hit.opportunityType === "local_news" && /best\s+\d+|top\s+\d+|near me|near\s+\w+/i.test(hay) && !/sponsor|community|event|cleanup/i.test(hay)) {
    return { verdict: "reject", reason: "Generic listicle — not a sponsorship or community page" };
  }

  if (isSchoolHomepage(hit.url, hit.title, hay)) {
    return { verdict: "reject", reason: "School homepage without sponsor opportunity" };
  }

  if (/^https?:\/\/(www\.)?(facebook|instagram|twitter|x)\.com/i.test(hit.url) && !/sponsor|donate|fundrais/i.test(hay)) {
    return { verdict: "reject", reason: "Social media profile — not a structured local trust opportunity" };
  }

  if (/meetup\.com|runsignup\.com/i.test(domain) && !/sponsor|charity|fundrais|cleanup|community/i.test(hay)) {
    return { verdict: "reject", reason: "Event platform listing without clear sponsorship path" };
  }

  if (/eventeny\.com/i.test(domain)) {
    return { verdict: "reject", reason: "Event platform — not an official organization opportunity page" };
  }

  if (/meetup\.com/i.test(domain)) {
    return { verdict: "reject", reason: "Meetup event page — not an official organization sponsorship page" };
  }

  if (/patch\.com/i.test(domain) && !/sponsor(ship)?\s*(level|tier|package)|become a sponsor|sponsor contact/i.test(hay)) {
    return { verdict: "reject", reason: "News article without active sponsorship path" };
  }

  return { verdict: "keep", reason: "Passed rule filter" };
}
