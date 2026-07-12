import pLimit from "p-limit";
import { createServiceClient } from "@/lib/db/client";
import { loadCompetitorsForBusiness } from "@/lib/audit/run-audit";
import { parseUsAddressCityState } from "@/lib/geo/us-address";
import { searchCitations } from "@/lib/citations/discover";
import {
  authorityScoreForDomain,
  classifyOpportunity,
  difficultyForType,
  suggestedActionForType,
} from "@/lib/local-trust/classify";
import { ruleFilterOpportunity } from "@/lib/local-trust/filter";
import { buildLocalTrustQueries, inferCounty } from "@/lib/local-trust/queries";
import {
  actionabilityScore,
  matchesLocation,
  matchesTopic,
  priorityFromScore,
  scoreOpportunity,
} from "@/lib/local-trust/score";
import type {
  LocalTrustOpportunity,
  LocalTrustRescanSummary,
  LocalTrustRunResult,
  RejectedOpportunity,
  OpportunityType,
} from "@/lib/local-trust/types";
import { dedupeOpportunities, resolveDisplayGroup } from "@/lib/local-trust/accept-gate";
import { canonicalizeUrl, contentHash } from "@/lib/local-trust/canonical-url";
import {
  loadMarketCandidates,
  organizationKeyFromOpp,
  shouldSkipCandidate,
  upsertAcceptedCandidate,
  upsertRejectedCandidate,
} from "@/lib/local-trust/candidates";
import { countMarketAcceptedOpportunities } from "@/lib/local-trust/markets";
import { fetchOpportunityPage } from "@/lib/local-trust/fetch-opportunity-page";
import {
  fallbackLocalTrustTasks,
  generateLocalTrustAnalysis,
} from "@/lib/providers/deepseek/local-trust";
import { filterLocalTrustWithLlm } from "@/lib/providers/deepseek/local-trust-filter";
import { verifyLocalTrustPage } from "@/lib/providers/deepseek/local-trust-verify";

const SEARCH_CONCURRENCY = 3;
const PAGE_FETCH_CONCURRENCY = 3;
const PAGE_VERIFY_CONCURRENCY = 2;
const MIN_SCORE = 15;
const LLM_FILTER_CAP = 120;
const PAGE_VERIFY_CAP = 40;

function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function competitorMentioned(text: string, competitors: Array<{ name: string; website?: string }>): boolean {
  const hay = text.toLowerCase();
  return competitors.some((c) => {
    if (c.name.length > 3 && hay.includes(c.name.toLowerCase())) return true;
    if (c.website) {
      const d = domainFromUrl(c.website.startsWith("http") ? c.website : `https://${c.website}`);
      if (d && hay.includes(d)) return true;
    }
    return false;
  });
}

async function updateProgress(runId: string, stage: string) {
  const supabase = createServiceClient();
  await supabase.from("local_trust_runs").update({ progress_stage: stage }).eq("id", runId);
}

export async function runLocalTrustFinder(params: {
  businessId: string;
  organizationId: string;
  city?: string;
  state?: string;
  county?: string | null;
  rescan?: boolean;
}): Promise<LocalTrustRunResult> {
  const supabase = createServiceClient();
  const warnings: string[] = [];

  const { data: business } = await supabase.from("businesses").select("*").eq("id", params.businessId).single();
  if (!business) throw new Error("Business not found");

  const { data: keywords } = await supabase
    .from("business_keywords")
    .select("keyword, city, state, is_primary")
    .eq("business_id", params.businessId);
  const primary = keywords?.find((k) => k.is_primary) ?? keywords?.[0];

  const fromAddress = parseUsAddressCityState(business.address_text);
  const city = params.city?.trim() || primary?.city?.trim() || fromAddress.city || "";
  const state = params.state?.trim() || primary?.state?.trim() || fromAddress.state || "";
  const county = params.county?.trim() || inferCounty(city, business.address_text);
  const category = (business.primary_category as string) ?? "local business";
  const keyword = primary?.keyword ?? category;

  if (!city || !state) {
    throw new Error("City and state are required. Set primary keyword or ensure GMB address is on file.");
  }

  const { data: priorRuns } = await supabase
    .from("local_trust_runs")
    .select("id")
    .eq("business_id", params.businessId)
    .eq("city", city)
    .eq("state", state)
    .eq("status", "complete")
    .limit(1);

  const scanType: "initial" | "rescan" =
    (params.rescan || (priorRuns?.length ?? 0) > 0) ? "rescan" : "initial";

  const candidateMemory = scanType === "rescan" ? await loadMarketCandidates(params.businessId, city, state) : new Map();

  const rescanStats = {
    candidatesFound: 0,
    alreadyKnown: 0,
    previouslyRejected: 0,
    alreadyAccepted: 0,
    newCandidatesChecked: 0,
    newOpportunitiesAdded: 0,
  };

  const { data: runRow } = await supabase
    .from("local_trust_runs")
    .insert({
      organization_id: params.organizationId,
      business_id: params.businessId,
      status: "running",
      city,
      county: county ?? "",
      state,
      keyword,
      scan_type: scanType,
      progress_stage: "Generating search queries",
    })
    .select("id")
    .single();

  const runId = runRow!.id as string;

  try {
    const competitors = await loadCompetitorsForBusiness(params.businessId);
    const ownDomain = business.website_url ? domainFromUrl(business.website_url.startsWith("http") ? business.website_url : `https://${business.website_url}`) : "";
    const competitorDomains = new Set(
      competitors.map((c) => (c.website ? domainFromUrl(c.website.startsWith("http") ? c.website : `https://${c.website}`) : "")).filter(Boolean)
    );
    const searchQueries = buildLocalTrustQueries({
      city,
      county: county ?? "",
      state,
      category,
      serviceKeyword: keyword,
    });

    await supabase
      .from("local_trust_runs")
      .update({ search_queries_json: searchQueries })
      .eq("id", runId);

    await updateProgress(runId, "Searching local trust opportunities");

    const limit = pLimit(SEARCH_CONCURRENCY);
    const hitMap = new Map<string, LocalTrustOpportunity & { searchQuery: string }>();

    const searchResults = await Promise.all(
      searchQueries.map((query) =>
        limit(async () => {
          const { hits, warning } = await searchCitations({
            query,
            organizationId: params.organizationId,
          });
          if (warning) warnings.push(warning);
          return { query, hits };
        })
      )
    );

    const topicKeywords = [keyword, category, ...category.split(/\s+/).filter((w) => w.length > 3)];

    for (const { query, hits } of searchResults) {
      for (const hit of hits) {
        if (!hit.url) continue;
        const canonical = canonicalizeUrl(hit.url);
        if (hitMap.has(canonical)) continue;

        const mem = candidateMemory.get(canonical);
        const preCheck = shouldSkipCandidate(mem);
        if (preCheck.action === "skip") {
          rescanStats.alreadyKnown++;
          rescanStats.previouslyRejected++;
          continue;
        }
        if (preCheck.action === "carry_forward") {
          rescanStats.alreadyKnown++;
          rescanStats.alreadyAccepted++;
          continue;
        }

        const domain = hit.domain || domainFromUrl(hit.url);
        if (domain === ownDomain || competitorDomains.has(domain)) continue;

        const snippet = `${hit.title} ${hit.description ?? ""}`;
        const opportunityType = classifyOpportunity(hit);

        const ruleResult = ruleFilterOpportunity({
          title: hit.title || domain,
          url: hit.url,
          domain,
          description: hit.description,
          opportunityType,
        });
        if (ruleResult.verdict === "reject") continue;

        const { cityMatch, countyMatch } = matchesLocation(snippet + " " + hit.url, city, county);
        const topicalMatch = matchesTopic(snippet, category, topicKeywords);
        const authorityScore = authorityScoreForDomain(domain, opportunityType);
        const competitorPresent = competitorMentioned(snippet, competitors);
        const actionability = actionabilityScore(snippet, opportunityType);

        const relevanceScore = scoreOpportunity({
          city,
          county: county ?? "",
          category,
          cityMatch,
          countyMatch,
          topicalMatch,
          competitorPresent,
          authorityScore,
          opportunityType,
          actionabilityHint: actionability,
        });

        const priority = priorityFromScore(relevanceScore);
        if (priority === "ignore" || relevanceScore < MIN_SCORE) continue;

        const opp: LocalTrustOpportunity = {
          title: hit.title || domain,
          url: hit.url,
          domain,
          opportunityType,
          cityMatch,
          countyMatch,
          topicalMatch,
          competitorPresent,
          authorityScore,
          relevanceScore,
          difficulty: difficultyForType(opportunityType),
          priority,
          suggestedAction: suggestedActionForType(opportunityType),
          evidenceSnippet: (hit.description ?? "").slice(0, 300),
          searchQuery: query,
          raw: { title: hit.title, description: hit.description, query, ruleFilter: ruleResult.reason },
        };

        hitMap.set(canonical, opp);
      }
    }

    rescanStats.candidatesFound = hitMap.size;

    let candidates = [...hitMap.values()].sort((a, b) => b.relevanceScore - a.relevanceScore);
    let filteredOutCount = 0;
    const rejectedOpportunities: RejectedOpportunity[] = [];

    await updateProgress(runId, "Validating opportunities with AI");

    const llmCandidates = candidates.slice(0, LLM_FILTER_CAP);
    const llmVerdicts = await filterLocalTrustWithLlm({
      organizationId: params.organizationId,
      businessName: business.name as string,
      city,
      county: county ?? "",
      state,
      category,
      items: llmCandidates.map((o) => ({
        url: o.url,
        title: o.title,
        domain: o.domain,
        snippet: o.evidenceSnippet,
        opportunityType: o.opportunityType,
      })),
    });

    candidates = candidates.filter((o) => {
      const verdict = llmVerdicts.get(o.url);
      if (!verdict) return true;
        if (verdict.verdict === "reject") {
        filteredOutCount++;
        const rejected: RejectedOpportunity = {
          title: o.title,
          url: o.url,
          domain: o.domain,
          stage: "snippet_filter",
          reason: verdict.reason,
          opportunityType: o.opportunityType,
        };
        rejectedOpportunities.push(rejected);
        void upsertRejectedCandidate({
            organizationId: params.organizationId,
            businessId: params.businessId,
            marketCity: city,
            marketState: state,
            marketCounty: county,
            runId,
            rejected,
            organizationKey: organizationKeyFromOpp(o.title, o.domain, city, state),
        });
        return false;
      }
      if (verdict.opportunityType) {
        o.opportunityType = verdict.opportunityType;
        o.suggestedAction = suggestedActionForType(verdict.opportunityType);
        o.difficulty = difficultyForType(verdict.opportunityType);
      }
      o.raw = { ...o.raw, llmFilter: verdict.reason };
      return true;
    });

    await updateProgress(runId, "Reading and verifying page content");

    const verifyLimit = pLimit(PAGE_VERIFY_CONCURRENCY);
    const fetchLimit = pLimit(PAGE_FETCH_CONCURRENCY);
    const verifyCandidates = candidates.slice(0, PAGE_VERIFY_CAP);

    const verified = await Promise.all(
      verifyCandidates.map((o) =>
        verifyLimit(async () => {
          const canonical = canonicalizeUrl(o.url);
          const mem = candidateMemory.get(canonical);
          const skipDecision = shouldSkipCandidate(mem);
          if (skipDecision.action === "skip") {
            filteredOutCount++;
            rescanStats.previouslyRejected++;
            rejectedOpportunities.push({
              title: o.title,
              url: o.url,
              domain: o.domain,
              stage: "page_verify",
              reason: `Auto-skipped: ${skipDecision.reason}`,
              opportunityType: o.opportunityType,
            });
            return null;
          }
          if (skipDecision.action === "carry_forward") {
            rescanStats.alreadyAccepted++;
            return null;
          }

          rescanStats.newCandidatesChecked++;

          const page = await fetchLimit(() =>
            fetchOpportunityPage(o.url, params.organizationId)
          );

          if (page.fetchStatus !== "ok") {
            filteredOutCount++;
            const rejected: RejectedOpportunity = {
              title: o.title,
              url: o.url,
              domain: o.domain,
              stage: "page_fetch",
              reason: `Could not read page content (${page.fetchStatus})`,
              opportunityType: o.opportunityType,
            };
            rejectedOpportunities.push(rejected);
            void upsertRejectedCandidate({
              organizationId: params.organizationId,
              businessId: params.businessId,
              marketCity: city,
              marketState: state,
              marketCounty: county,
              runId,
              rejected,
              organizationKey: organizationKeyFromOpp(o.title, o.domain, city, state),
            });
            return null;
          }

          const pageHash = contentHash(page.bodyText ?? page.title ?? "");

          const verification = await verifyLocalTrustPage({
            organizationId: params.organizationId,
            businessName: business.name as string,
            city,
            county: county ?? "",
            state,
            category,
            candidate: {
              url: o.url,
              title: o.title,
              domain: o.domain,
              snippet: o.evidenceSnippet,
              opportunityType: o.opportunityType,
              page,
            },
          });

          o.raw = {
            ...o.raw,
            pageFetch: {
              status: page.fetchStatus,
              wordCount: page.wordCount,
              title: page.title,
              headings: page.headings,
              actionLinks: page.actionLinks,
              contactHints: page.contactHints,
            },
            verification: {
              include: verification.include,
              confidence: verification.confidence,
              localRelevance: verification.localRelevance,
              organizationName: verification.organizationName,
              reason: verification.reason,
              nextAction: verification.nextAction,
              actionUrl: verification.actionUrl,
              rejectReason: verification.rejectReason,
              llmProvider: verification.llmProvider,
            },
          };

          if (!verification.include) {
            filteredOutCount++;
            const rejected: RejectedOpportunity = {
              title: o.title,
              url: o.url,
              domain: o.domain,
              stage: "page_verify",
              reason: verification.rejectReason ?? verification.reason,
              opportunityType: verification.opportunityType ?? o.opportunityType,
              confidence: verification.confidence,
              localRelevance: verification.localRelevance,
            };
            rejectedOpportunities.push(rejected);
            void upsertRejectedCandidate({
              organizationId: params.organizationId,
              businessId: params.businessId,
              marketCity: city,
              marketState: state,
              marketCounty: county,
              runId,
              rejected,
              organizationKey: organizationKeyFromOpp(o.title, o.domain, city, state),
              contentHash: pageHash,
            });
            return null;
          }

          if (verification.opportunityType) {
            o.opportunityType = verification.opportunityType;
            o.suggestedAction = verification.nextAction ?? suggestedActionForType(verification.opportunityType);
            o.difficulty = difficultyForType(verification.opportunityType);
          } else if (verification.nextAction) {
            o.suggestedAction = verification.nextAction;
          }

          if (verification.organizationName) {
            o.title = verification.organizationName;
          }

          o.evidenceSnippet = verification.reason.slice(0, 300);
          o.relevanceScore = Math.round(
            (o.relevanceScore + verification.confidence + verification.localRelevance) / 3
          );
          o.priority = priorityFromScore(o.relevanceScore);
          if (verification.highPriority) {
            o.priority = "high";
          } else if (verification.confidence >= 85 || verification.localRelevance >= 80) {
            o.priority = o.priority === "high" ? "medium" : o.priority;
          }

          o.raw = {
            ...o.raw,
            displayGroup: resolveDisplayGroup({
              opportunityType: o.opportunityType,
              url: o.url,
              title: o.title,
              domain: o.domain,
            }),
            contentHash: pageHash,
            canonicalUrl: canonical,
          };

          return o;
        })
      )
    );

    const verifiedList = verified.filter((o): o is LocalTrustOpportunity => o !== null);
    const beforeDedupe = verifiedList.length;
    const opportunities = dedupeOpportunities(verifiedList);
    rescanStats.newOpportunitiesAdded = opportunities.length;
    if (opportunities.length < beforeDedupe) {
      filteredOutCount += beforeDedupe - opportunities.length;
    }
    const highPriorityCount = opportunities.filter((o) => o.priority === "high").length;
    const easyWinsCount = opportunities.filter(
      (o) => o.difficulty === "easy" && (o.priority === "high" || o.priority === "medium")
    ).length;
    const localRelevanceScore =
      opportunities.length > 0
        ? Math.round(
            opportunities.reduce((s, o) => s + (o.cityMatch ? 60 : 0) + (o.countyMatch ? 40 : 0), 0) /
              opportunities.length
          )
        : 0;

    await updateProgress(runId, "Generating AI summary");

    const ai = await generateLocalTrustAnalysis({
      organizationId: params.organizationId,
      payload: {
        business: business.name,
        city,
        county: county ?? "",
        state,
        category,
        opportunities: opportunities.slice(0, 25).map((o) => ({
          title: o.title,
          url: o.url,
          type: o.opportunityType,
          priority: o.priority,
          score: o.relevanceScore,
          snippet: o.evidenceSnippet,
        })),
        searchQueries,
        competitorMentions: opportunities.filter((o) => o.competitorPresent).map((o) => o.title),
      },
    });

    const aiData = ai ?? fallbackLocalTrustTasks(opportunities);
    const marketTotalAccepted =
      (await countMarketAcceptedOpportunities(params.businessId, city, state)) + opportunities.length;

    const rescanSummary: LocalTrustRescanSummary = {
      ...rescanStats,
      marketTotalAccepted,
    };

    const aiPayload = {
      ...aiData,
      filtered_out_count: filteredOutCount,
      rejected_opportunities: rejectedOpportunities,
      rescan_summary: scanType === "rescan" ? rescanSummary : undefined,
    };

    const verifiedAt = new Date().toISOString();
    const oppRows = opportunities.map((o) => ({
      run_id: runId,
      organization_id: params.organizationId,
      business_id: params.businessId,
      title: o.title,
      url: o.url,
      domain: o.domain,
      opportunity_type: o.opportunityType,
      city_match: o.cityMatch,
      county_match: o.countyMatch,
      topical_match: o.topicalMatch,
      competitor_present: o.competitorPresent,
      authority_score: o.authorityScore,
      relevance_score: o.relevanceScore,
      difficulty: o.difficulty,
      priority: o.priority,
      suggested_action: o.suggestedAction,
      evidence_snippet: o.evidenceSnippet,
      status: "open",
      raw_json: o.raw,
      market_city: city,
      market_state: state,
      market_county: county,
      search_query: o.searchQuery,
      canonical_url: (o.raw.canonicalUrl as string) ?? canonicalizeUrl(o.url),
      content_hash: (o.raw.contentHash as string) ?? null,
      organization_key: organizationKeyFromOpp(o.title, o.domain, city, state),
      verified_at: verifiedAt,
    }));

    if (oppRows.length) {
      await supabase.from("local_trust_opportunities").insert(oppRows);
    }

    const { data: insertedOpps } = await supabase
      .from("local_trust_opportunities")
      .select("id, title, url, domain, opportunity_type, canonical_url")
      .eq("run_id", runId);

    if (insertedOpps?.length) {
      for (const row of insertedOpps) {
        void upsertAcceptedCandidate({
          organizationId: params.organizationId,
          businessId: params.businessId,
          marketCity: city,
          marketState: state,
          marketCounty: county,
          runId,
          url: row.url as string,
          title: row.title as string,
          domain: (row.domain as string) ?? "",
          opportunityType: row.opportunity_type as string,
          organizationKey: organizationKeyFromOpp(
            row.title as string,
            (row.domain as string) ?? "",
            city,
            state
          ),
          opportunityId: row.id as string,
        });
      }
    }

    const oppByTitle = new Map((insertedOpps ?? []).map((o) => [o.title, o.id]));

    const taskRows = aiData.tasks.map((t) => ({
      run_id: runId,
      organization_id: params.organizationId,
      business_id: params.businessId,
      opportunity_id: oppByTitle.get(t.description) ?? null,
      title: t.title,
      description: t.description,
      priority: t.priority,
      impact: t.impact,
      effort: t.effort,
      status: "open",
      evidence_json: { evidence: t.evidence },
    }));

    if (taskRows.length) {
      await supabase.from("local_trust_tasks").insert(taskRows);
    }

    await supabase
      .from("local_trust_runs")
      .update({
        status: "complete",
        opportunities_found: scanType === "rescan" ? rescanStats.newOpportunitiesAdded : opportunities.length,
        high_priority_count: highPriorityCount,
        local_relevance_score: localRelevanceScore,
        easy_wins_count: easyWinsCount,
        ai_summary: aiData.summary,
        ai_json: aiPayload,
        filtered_out_count: filteredOutCount,
        rescan_summary_json: scanType === "rescan" ? rescanSummary : {},
        progress_stage: null,
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);

    const { data: tasks } = await supabase.from("local_trust_tasks").select("*").eq("run_id", runId);

    return {
      runId,
      status: "complete",
      scanType,
      marketCity: city,
      marketState: state,
      marketCounty: county,
      opportunitiesFound: scanType === "rescan" ? rescanStats.newOpportunitiesAdded : opportunities.length,
      highPriorityCount,
      localRelevanceScore,
      easyWinsCount,
      aiSummary: aiData.summary,
      opportunities,
      rejectedOpportunities,
      tasks: tasks ?? [],
      searchQueries,
      warnings,
      filteredOutCount,
      rescanSummary: scanType === "rescan" ? rescanSummary : undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Local trust finder failed";
    await supabase
      .from("local_trust_runs")
      .update({ status: "failed", error_message: message, finished_at: new Date().toISOString() })
      .eq("id", runId);
    throw err;
  }
}

export async function getLatestLocalTrustRunId(
  businessId: string,
  market?: { city: string; state: string }
): Promise<string | null> {
  const supabase = createServiceClient();
  let query = supabase
    .from("local_trust_runs")
    .select("id")
    .eq("business_id", businessId)
    .eq("status", "complete")
    .order("created_at", { ascending: false })
    .limit(1);

  if (market?.city) query = query.eq("city", market.city);
  if (market?.state) query = query.eq("state", market.state);

  const { data } = await query.maybeSingle();
  return data?.id ?? null;
}

/** Latest complete run id per city|state market (newest first). */
export async function getLatestRunIdsPerMarket(businessId: string): Promise<string[]> {
  const supabase = createServiceClient();
  const { data: runs } = await supabase
    .from("local_trust_runs")
    .select("id, city, state, status, created_at")
    .eq("business_id", businessId)
    .eq("status", "complete")
    .order("created_at", { ascending: false });

  const latestByMarket = new Map<string, string>();
  for (const run of runs ?? []) {
    const city = (run.city as string) ?? "";
    const state = (run.state as string) ?? "";
    if (!city || !state) continue;
    const key = `${city.toLowerCase()}|${state.toLowerCase()}`;
    if (!latestByMarket.has(key)) latestByMarket.set(key, run.id as string);
  }
  return [...latestByMarket.values()];
}

export type LocalTrustOpportunityQuery = {
  businessId: string;
  page?: number;
  pageSize?: number;
  opportunityType?: string | null;
  displayGroup?: string | null;
  priority?: string | null;
  competitorPresent?: boolean;
  status?: "open" | "all";
  marketCity?: string | null;
  marketState?: string | null;
  allMarkets?: boolean;
  runId?: string | null;
  /** Return all matching rows in `items` (for aggregations). */
  aggregate?: boolean;
};

function displayGroupForRow(row: {
  opportunity_type: string;
  title: string;
  url: string;
  domain: string | null;
  raw_json: Record<string, unknown> | null;
}): string {
  const raw = row.raw_json;
  if (raw && typeof raw.displayGroup === "string") return raw.displayGroup;
  return resolveDisplayGroup({
    opportunityType: row.opportunity_type as OpportunityType,
    url: row.url,
    title: row.title,
    domain: row.domain ?? "",
  });
}

export async function queryLocalTrustOpportunities(params: LocalTrustOpportunityQuery) {
  const supabase = createServiceClient();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.aggregate
    ? Math.min(10000, Math.max(1, params.pageSize ?? 10000))
    : Math.min(100, Math.max(1, params.pageSize ?? 10));

  let query = supabase.from("local_trust_opportunities").select("*", { count: "exact" }).eq("business_id", params.businessId);

  if (params.runId) {
    query = query.eq("run_id", params.runId);
  } else if (params.allMarkets) {
    const runIds = await getLatestRunIdsPerMarket(params.businessId);
    if (runIds.length) query = query.in("run_id", runIds);
  } else if (params.marketCity && params.marketState) {
    const runId = await getLatestLocalTrustRunId(params.businessId, {
      city: params.marketCity,
      state: params.marketState,
    });
    if (runId) {
      query = query.eq("run_id", runId);
    } else {
      query = query.eq("market_city", params.marketCity).eq("market_state", params.marketState);
    }
  } else {
    const runId = await getLatestLocalTrustRunId(params.businessId);
    if (!runId) {
      return { items: [], total: 0, page: 1, pageSize, runId: null, marketTotal: 0 };
    }
    query = query.eq("run_id", runId);
  }

  if (params.status !== "all") query = query.eq("status", "open");
  if (params.opportunityType) query = query.eq("opportunity_type", params.opportunityType);
  if (params.priority) query = query.eq("priority", params.priority);
  if (params.competitorPresent) query = query.eq("competitor_present", true);

  const { data, error } = await query.order("relevance_score", { ascending: false });

  if (error) throw new Error(error.message);

  let rows = data ?? [];

  // Dedupe by canonical URL when viewing a market or all markets
  if (params.allMarkets || (params.marketCity && params.marketState)) {
    const byCanon = new Map<string, (typeof rows)[0]>();
    for (const row of rows) {
      const canon =
        (row.canonical_url as string) || canonicalizeUrl(row.url as string);
      const existing = byCanon.get(canon);
      if (!existing || new Date(row.created_at) > new Date(existing.created_at)) {
        byCanon.set(canon, row);
      }
    }
    rows = [...byCanon.values()].sort(
      (a, b) => Number(b.relevance_score) - Number(a.relevance_score)
    );
  }

  if (params.displayGroup) {
    rows = rows.filter((row) => displayGroupForRow(row) === params.displayGroup);
  }

  const total = rows.length;
  const offset = (page - 1) * pageSize;
  const items = params.aggregate ? rows : rows.slice(offset, offset + pageSize);

  const runId =
    params.runId ??
    (params.marketCity && params.marketState
      ? await getLatestLocalTrustRunId(params.businessId, {
          city: params.marketCity,
          state: params.marketState,
        })
      : await getLatestLocalTrustRunId(params.businessId));

  return {
    items,
    total,
    page,
    pageSize,
    runId,
    marketTotal: total,
  };
}

export async function getLocalTrustTypeCounts(
  businessId: string,
  market?: { city: string; state: string } | null,
  allMarkets?: boolean
) {
  const result = await queryLocalTrustOpportunities({
    businessId,
    page: 1,
    pageSize: 10000,
    status: "open",
    marketCity: allMarkets ? null : market?.city,
    marketState: allMarkets ? null : market?.state,
    allMarkets,
    aggregate: true,
  });

  const counts = new Map<string, number>();
  for (const row of result.items) {
    const group = displayGroupForRow(row);
    counts.set(group, (counts.get(group) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
}

export async function loadLatestLocalTrustRun(
  businessId: string,
  options?: { city?: string; state?: string; runId?: string }
) {
  const supabase = createServiceClient();

  let runQuery = supabase.from("local_trust_runs").select("*").eq("business_id", businessId);

  if (options?.runId) {
    runQuery = runQuery.eq("id", options.runId);
  } else if (options?.city && options?.state) {
    runQuery = runQuery.eq("city", options.city).eq("state", options.state).eq("status", "complete");
  } else {
    runQuery = runQuery.eq("status", "complete");
  }

  const { data: run } = await runQuery.order("created_at", { ascending: false }).limit(1).maybeSingle();

  if (!run) {
    const { data: inProgress } = await supabase
      .from("local_trust_runs")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!inProgress) return null;
    return {
      run: inProgress,
      opportunities: [],
      tasks: [],
      searchQueries: (inProgress.search_queries_json as string[]) ?? [],
      aiJson: inProgress.ai_json as Record<string, unknown> | null,
    };
  }

  const { data: tasks } = await supabase.from("local_trust_tasks").select("*").eq("run_id", run.id);

  return {
    run,
    opportunities: [],
    tasks: tasks ?? [],
    searchQueries: (run.search_queries_json as string[]) ?? [],
    aiJson: run.ai_json as Record<string, unknown> | null,
  };
}

export async function createLocalTrustTasksFromRun(runId: string, businessId: string, organizationId: string) {
  const supabase = createServiceClient();
  const { data: existing } = await supabase.from("local_trust_tasks").select("id").eq("run_id", runId);
  if (existing?.length) return existing.length;

  const { data: opps } = await supabase
    .from("local_trust_opportunities")
    .select("*")
    .eq("run_id", runId)
    .in("priority", ["high", "medium"])
    .limit(10);

  const rows = (opps ?? []).map((o) => ({
    run_id: runId,
    organization_id: organizationId,
    business_id: businessId,
    opportunity_id: o.id,
    title: o.suggested_action ?? `Pursue: ${o.title}`,
    description: o.title,
    priority: o.priority,
    impact: o.priority === "high" ? "high" : "medium",
    effort: o.difficulty === "easy" ? "low" : o.difficulty === "hard" ? "high" : "medium",
    status: "open",
    evidence_json: { url: o.url, snippet: o.evidence_snippet },
  }));

  if (rows.length) await supabase.from("local_trust_tasks").insert(rows);
  return rows.length;
}
