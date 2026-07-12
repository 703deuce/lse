const SPAM_PATTERNS = [
  /siteprice/i,
  /worthofweb/i,
  /hypestat/i,
  /statscrop/i,
  /websiteseochecker/i,
  /seoquake/i,
  /semrush/i,
  /ahrefs\.com\/backlink/i,
  /backlink.*checker/i,
  /expired.*domain/i,
  /domain.*list/i,
  /buy.*backlink/i,
  /sell.*backlink/i,
  /backlink.*sale/i,
  /pbn/i,
  /web\.archive\.org/i,
  /cache:/i,
  /wayback/i,
  /spamscore/i,
  /seokicks/i,
  /similarweb/i,
  /alexa\.com/i,
  /whois/i,
  /domainstats/i,
  /rankwatch/i,
  /smallseotools/i,
];

const ADULT_GAMBLING_PHARMA = [
  /porn/i,
  /xxx/i,
  /casino/i,
  /gambl/i,
  /viagra/i,
  /cialis/i,
  /pharma/i,
  /betting/i,
  /slots/i,
];

const AUTO_DIRECTORY_PATTERNS = [
  /^[a-z0-9-]+\.top$/,
  /^[a-z0-9-]+\.xyz$/,
  /^[a-z0-9-]+\.click$/,
  /^[a-z0-9-]+\.link$/,
  /freedirectory/i,
  /freewebdirectory/i,
  /addurl/i,
  /submiturl/i,
  /linkdirectory/i,
];

export type SpamVerdict = "ok" | "spam" | "suspicious";

export function assessSpamDomain(domain: string, signals?: { spamScore?: number | null }): SpamVerdict {
  const d = domain.toLowerCase();

  for (const p of SPAM_PATTERNS) {
    if (p.test(d)) return "spam";
  }
  for (const p of ADULT_GAMBLING_PHARMA) {
    if (p.test(d)) return "spam";
  }
  for (const p of AUTO_DIRECTORY_PATTERNS) {
    if (p.test(d)) return "suspicious";
  }

  if (signals?.spamScore != null && signals.spamScore >= 60) return "spam";
  if (signals?.spamScore != null && signals.spamScore >= 40) return "suspicious";

  return "ok";
}

export function isObviousSpam(domain: string, signals?: { spamScore?: number | null }): boolean {
  return assessSpamDomain(domain, signals) === "spam";
}
