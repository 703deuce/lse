import type { BusinessIdentity, MessagingBusinessForm } from "./types";

/** Twilio TrustHub business_type enumerations. */
const BUSINESS_TYPE_MAP: Record<string, string> = {
  llc: "Limited Liability Corporation",
  "limited liability corporation": "Limited Liability Corporation",
  "limited liability company": "Limited Liability Corporation",
  corporation: "Corporation",
  corp: "Corporation",
  inc: "Corporation",
  partnership: "Partnership",
  "sole proprietorship": "Sole Proprietorship",
  "sole proprietor": "Sole Proprietorship",
  "co-operative": "Co-operative",
  cooperative: "Co-operative",
  "non-profit": "Non-profit Corporation",
  nonprofit: "Non-profit Corporation",
  "non-profit corporation": "Non-profit Corporation",
  "limited partnership": "Limited Partnership",
  government: "Corporation",
  other: "Corporation",
};

/** Twilio TrustHub business_industry enumerations. */
const INDUSTRY_MAP: Record<string, string> = {
  agriculture: "AGRICULTURE",
  automotive: "AUTOMOTIVE",
  banking: "BANKING",
  consumer: "CONSUMER",
  education: "EDUCATION",
  electronics: "ELECTRONICS",
  energy: "ENERGY",
  engineering: "ENGINEERING",
  "fast moving consumer goods": "FAST_MOVING_CONSUMER_GOODS",
  fmcg: "FAST_MOVING_CONSUMER_GOODS",
  financial: "FINANCIAL",
  finance: "FINANCIAL",
  "food and beverage": "FOOD_AND_BEVERAGE",
  food: "FOOD_AND_BEVERAGE",
  government: "GOVERNMENT",
  healthcare: "HEALTHCARE",
  health: "HEALTHCARE",
  "home services": "PROFESSIONAL_SERVICES",
  hospitality: "HOSPITALITY",
  insurance: "INSURANCE",
  jewelry: "JEWELRY",
  legal: "LEGAL",
  manufacturing: "MANUFACTURING",
  media: "MEDIA",
  "not for profit": "NOT_FOR_PROFIT",
  nonprofit: "NOT_FOR_PROFIT",
  "oil and gas": "OIL_AND_GAS",
  online: "ONLINE",
  "professional services": "PROFESSIONAL_SERVICES",
  services: "PROFESSIONAL_SERVICES",
  "raw materials": "RAW_MATERIALS",
  "real estate": "REAL_ESTATE",
  religion: "RELIGION",
  retail: "RETAIL",
  technology: "TECHNOLOGY",
  tech: "TECHNOLOGY",
  telecommunications: "TELECOMMUNICATIONS",
  transportation: "TRANSPORTATION",
  travel: "TRAVEL",
};

const JOB_POSITIONS = [
  "CEO",
  "CFO",
  "Director",
  "GM",
  "VP",
  "General_Counsel",
  "Other",
] as const;

export const TWILIO_INDUSTRY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "PROFESSIONAL_SERVICES", label: "Professional services / home services" },
  { value: "HEALTHCARE", label: "Healthcare" },
  { value: "REAL_ESTATE", label: "Real estate" },
  { value: "RETAIL", label: "Retail" },
  { value: "AUTOMOTIVE", label: "Automotive" },
  { value: "FOOD_AND_BEVERAGE", label: "Food and beverage" },
  { value: "HOSPITALITY", label: "Hospitality" },
  { value: "LEGAL", label: "Legal" },
  { value: "FINANCIAL", label: "Financial" },
  { value: "INSURANCE", label: "Insurance" },
  { value: "EDUCATION", label: "Education" },
  { value: "TECHNOLOGY", label: "Technology" },
  { value: "ENGINEERING", label: "Engineering / construction" },
  { value: "NOT_FOR_PROFIT", label: "Not for profit" },
  { value: "GOVERNMENT", label: "Government" },
  { value: "CONSUMER", label: "Other / consumer" },
];

export function mapTwilioBusinessType(raw: string): string {
  const key = raw.trim().toLowerCase();
  return BUSINESS_TYPE_MAP[key] ?? "Limited Liability Corporation";
}

export function mapTwilioBusinessIndustry(raw: string): string {
  const trimmed = raw.trim();
  if (/^[A-Z0-9_]+$/.test(trimmed) && trimmed.length > 2) return trimmed;
  const key = trimmed.toLowerCase();
  if (INDUSTRY_MAP[key]) return INDUSTRY_MAP[key]!;
  // ENGINEERING is the closest Twilio enum for construction-style industries.
  if (key.includes("construct") || key.includes("engineer")) return "ENGINEERING";
  if (key.includes("home") || key.includes("service")) return "PROFESSIONAL_SERVICES";
  return "PROFESSIONAL_SERVICES";
}

export function mapTwilioJobPosition(title: string, role: string): string {
  const hay = `${title} ${role}`.toLowerCase();
  if (/\bceo\b|chief executive/.test(hay)) return "CEO";
  if (/\bcfo\b|chief financial/.test(hay)) return "CFO";
  if (/general counsel|attorney|legal/.test(hay)) return "General_Counsel";
  if (/\bvp\b|vice president/.test(hay)) return "VP";
  if (/\bgm\b|general manager/.test(hay)) return "GM";
  if (/director/.test(hay)) return "Director";
  if (JOB_POSITIONS.includes(title as (typeof JOB_POSITIONS)[number])) return title;
  return "Other";
}

export function mapTwilioCompanyType(identity: BusinessIdentity | ""): string {
  switch (identity) {
    case "public":
      return "public";
    case "nonprofit":
      return "non_profit";
    case "government":
      return "government";
    case "sole_proprietor":
      return "sole_proprietor";
    default:
      return "private";
  }
}

export function mapTwilioRegionsOfOperation(regions: string[]): string {
  // Form collects US state codes; TrustHub wants region enums.
  if (regions.some((r) => /canada|ca\b/i.test(r))) return "USA_AND_CANADA";
  return "USA_AND_CANADA";
}

export function splitAuthRepName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "Authorized", lastName: "Representative" };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: parts[0]! };
  return { firstName: parts[0]!, lastName: parts.slice(1).join(" ") };
}

export function normalizeEin(ein: string): string {
  return ein.replace(/[^\d]/g, "");
}

export function toTrustHubBusinessAttributes(business: MessagingBusinessForm) {
  return {
    business_name: business.legalBusinessName.trim(),
    business_identity: "direct_customer",
    business_type: mapTwilioBusinessType(business.businessType),
    business_industry: mapTwilioBusinessIndustry(business.businessIndustry),
    business_registration_identifier: "EIN",
    business_registration_number: normalizeEin(business.ein),
    business_regions_of_operation: mapTwilioRegionsOfOperation(business.regionsOfOperation),
    website_url: business.websiteUrl.trim(),
  };
}
