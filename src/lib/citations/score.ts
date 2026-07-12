import type { CitationSource } from "@/lib/citations/sources";
import type { NapStatus } from "@/lib/citations/nap-match";

export function computeCitationHealthScore(params: {
  sources: CitationSource[];
  foundDomains: Set<string>;
  listings: Array<{ nap_status: NapStatus; confidence: string; source_domain?: string | null }>;
  missingHighPriority: number;
  competitorGaps: number;
  totalHighPriority: number;
}): number {
  const highSources = params.sources.filter((s) => s.priority === "high");
  const highTotal = Math.max(highSources.length, 1);
  const highFound = highSources.filter((s) => params.foundDomains.has(s.domain)).length;
  const foundScore = (highFound / highTotal) * 35;

  const verified = params.listings.filter((l) => l.nap_status !== "unverified");
  const matchCount = verified.filter((l) => l.nap_status === "match").length;
  const partialCount = verified.filter((l) => l.nap_status === "partial").length;
  const napDenom = Math.max(verified.length, 1);
  const napScore = ((matchCount + partialCount * 0.5) / napDenom) * 30;

  const gapPenalty = Math.min(params.competitorGaps * 3, 20);
  const competitorScore = Math.max(0, 20 - gapPenalty);

  const trustDomains = new Set(["bbb.org", "chamberofcommerce.com", "yelp.com", "facebook.com"]);
  const trustFound = [...trustDomains].filter((d) => params.foundDomains.has(d)).length;
  const trustScore = (trustFound / trustDomains.size) * 10;

  const highConf = params.listings.filter((l) => l.confidence === "high").length;
  const confDenom = Math.max(params.listings.length, 1);
  const confScore = (highConf / confDenom) * 5;

  const raw = foundScore + napScore + competitorScore + trustScore + confScore;
  const missingPenalty = Math.min(params.missingHighPriority * 2, 15);
  return Math.round(Math.max(0, Math.min(100, raw - missingPenalty)));
}
