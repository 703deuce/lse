import { createServiceClient } from "@/lib/db/client";
import { canonicalizeUrl, contentHash } from "@/lib/local-trust/canonical-url";
import type { RejectedOpportunity } from "@/lib/local-trust/types";

export type CandidateStatus =
  | "accepted"
  | "rejected"
  | "duplicate"
  | "unreadable"
  | "stale"
  | "ignored";

export type StoredCandidate = {
  id: string;
  canonical_url: string;
  original_url: string;
  candidate_status: CandidateStatus;
  reject_reason: string | null;
  reject_stage: string | null;
  content_hash: string | null;
  skip_until: string | null;
  organization_key: string | null;
  title: string | null;
  opportunity_id: string | null;
};

export type CandidateSkipResult =
  | { action: "skip"; reason: string }
  | { action: "verify"; reason?: string }
  | { action: "carry_forward"; candidate: StoredCandidate };

function skipUntilForReject(stage: string, reason: string): Date {
  const now = new Date();
  const days = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);

  if (/wrong state|wrong city|new jersey|delaware|connecticut/i.test(reason)) {
    return days(180);
  }
  if (/listicle|directory|competitor|yelp|patch|eventeny|meetup/i.test(reason)) {
    return days(180);
  }
  if (stage === "page_fetch" || /thin|blocked|unreadable/i.test(reason)) {
    return days(45);
  }
  if (/school homepage without sponsor/i.test(reason)) {
    return days(75);
  }
  return days(90);
}

export async function loadMarketCandidates(
  businessId: string,
  marketCity: string,
  marketState: string
): Promise<Map<string, StoredCandidate>> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("local_trust_candidates")
    .select(
      "id, canonical_url, original_url, candidate_status, reject_reason, reject_stage, content_hash, skip_until, organization_key, title, opportunity_id"
    )
    .eq("business_id", businessId)
    .eq("market_city", marketCity)
    .eq("market_state", marketState);

  const map = new Map<string, StoredCandidate>();
  for (const row of data ?? []) {
    map.set(row.canonical_url as string, row as StoredCandidate);
  }
  return map;
}

export function shouldSkipCandidate(
  candidate: StoredCandidate | undefined,
  pageContentHash?: string
): CandidateSkipResult {
  if (!candidate) return { action: "verify" };

  const now = Date.now();
  if (candidate.skip_until && new Date(candidate.skip_until).getTime() > now) {
    if (candidate.candidate_status === "rejected" || candidate.candidate_status === "unreadable") {
      return { action: "skip", reason: candidate.reject_reason ?? "Previously rejected" };
    }
    if (candidate.candidate_status === "ignored") {
      return { action: "skip", reason: "User ignored" };
    }
  }

  if (candidate.candidate_status === "accepted" && candidate.opportunity_id) {
    if (!pageContentHash || !candidate.content_hash || candidate.content_hash === pageContentHash) {
      return { action: "carry_forward", candidate };
    }
    return { action: "verify", reason: "Page content changed" };
  }

  if (candidate.candidate_status === "duplicate") {
    return { action: "skip", reason: "Duplicate organization" };
  }

  return { action: "verify" };
}

export async function upsertRejectedCandidate(params: {
  organizationId: string;
  businessId: string;
  marketCity: string;
  marketState: string;
  marketCounty?: string | null;
  runId: string;
  rejected: RejectedOpportunity;
  organizationKey?: string;
  contentHash?: string;
}) {
  const supabase = createServiceClient();
  const canonical = canonicalizeUrl(params.rejected.url);
  const skipUntil = skipUntilForReject(params.rejected.stage, params.rejected.reason);

  await supabase.from("local_trust_candidates").upsert(
    {
      organization_id: params.organizationId,
      business_id: params.businessId,
      market_city: params.marketCity,
      market_state: params.marketState,
      market_county: params.marketCounty ?? null,
      canonical_url: canonical,
      original_url: params.rejected.url,
      organization_key: params.organizationKey ?? null,
      title: params.rejected.title,
      domain: params.rejected.domain,
      opportunity_type: params.rejected.opportunityType,
      candidate_status: params.rejected.stage === "page_fetch" ? "unreadable" : "rejected",
      reject_reason: params.rejected.reason,
      reject_stage: params.rejected.stage,
      content_hash: params.contentHash ?? null,
      skip_until: skipUntil.toISOString(),
      last_seen_at: new Date().toISOString(),
      last_run_id: params.runId,
      raw_json: { confidence: params.rejected.confidence, localRelevance: params.rejected.localRelevance },
    },
    { onConflict: "business_id,market_city,market_state,canonical_url" }
  );
}

export async function upsertAcceptedCandidate(params: {
  organizationId: string;
  businessId: string;
  marketCity: string;
  marketState: string;
  marketCounty?: string | null;
  runId: string;
  url: string;
  title: string;
  domain: string;
  opportunityType: string;
  organizationKey: string;
  opportunityId: string;
  contentHash?: string;
}) {
  const supabase = createServiceClient();
  const canonical = canonicalizeUrl(params.url);

  await supabase.from("local_trust_candidates").upsert(
    {
      organization_id: params.organizationId,
      business_id: params.businessId,
      market_city: params.marketCity,
      market_state: params.marketState,
      market_county: params.marketCounty ?? null,
      canonical_url: canonical,
      original_url: params.url,
      organization_key: params.organizationKey,
      title: params.title,
      domain: params.domain,
      opportunity_type: params.opportunityType,
      candidate_status: "accepted",
      reject_reason: null,
      reject_stage: null,
      content_hash: params.contentHash ?? null,
      skip_until: null,
      last_seen_at: new Date().toISOString(),
      last_run_id: params.runId,
      opportunity_id: params.opportunityId,
    },
    { onConflict: "business_id,market_city,market_state,canonical_url" }
  );
}

export function organizationKeyFromOpp(title: string, domain: string, city: string, state: string): string {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  return `${norm(domain || title)}|${norm(city)}|${state.toLowerCase()}`;
}

export { contentHash };
