export type MatchStatus = "match" | "partial" | "missing" | "mismatch";

export interface AuditCheck {
  id: string;
  label: string;
  status: MatchStatus;
  gbpValue?: string;
  websiteValue?: string;
  evidence?: string;
  bucket: "relevance" | "distance" | "prominence" | "trust";
  whyItMatters?: string;
}

export interface ActionTask {
  title: string;
  description: string;
  why: string;
  impact: "low" | "medium" | "high";
  effort: "low" | "medium" | "high";
  bucket: "relevance" | "distance" | "prominence" | "trust";
  timeframe: "urgent" | "7-day" | "30-day";
  evidence?: string;
  module: string;
}

export interface GbpProfile {
  name: string;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  primaryCategory?: string | null;
  secondaryCategories?: string[];
  services?: string[];
  city?: string | null;
  state?: string | null;
  rating?: number;
  reviewCount?: number;
  photoCount?: number;
  postCount?: number;
  hoursText?: string | null;
  description?: string | null;
}

export interface ParsedPage {
  url: string;
  title: string | null;
  metaDescription: string | null;
  h1: string[];
  h2: string[];
  h3: string[];
  bodyText: string;
  wordCount: number;
  hasClickToCall: boolean;
  internalLinks: string[];
  hoursMentions: string[];
  neighborhoodMentions: string[];
}

export interface LoadedCompetitor {
  name: string;
  rank?: number;
  category?: string;
  additionalCategories?: string[];
  rating?: number;
  reviewCount?: number;
  photoCount?: number;
  postCount?: number;
  reviewKeywords?: string[];
  serviceKeywords?: string[];
  services?: string[];
  website?: string;
}

export function normalizePhone(p?: string | null): string {
  return (p ?? "").replace(/\D/g, "").slice(-10);
}

export function normalizeText(s?: string | null): string {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function compareText(a?: string | null, b?: string | null): MatchStatus {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na || !nb) return na || nb ? "missing" : "missing";
  if (na === nb) return "match";
  if (na.includes(nb) || nb.includes(na)) return "partial";
  return "mismatch";
}

export function scoreChecks(checks: AuditCheck[]): number {
  if (!checks.length) return 0;
  const weights = { match: 100, partial: 60, missing: 20, mismatch: 0 };
  return Math.round(checks.reduce((s, c) => s + weights[c.status], 0) / checks.length);
}
