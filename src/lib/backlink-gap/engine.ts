import pLimit from "p-limit";
import { createServiceClient } from "@/lib/db/client";
import { buildGridTopCompetitors } from "@/lib/maps/grid";
import { SCAN_RESULT_COMPETITOR_COLUMNS } from "@/lib/maps/scan-result-columns";
import { assertScanBelongsToBusiness } from "@/lib/db/queries";
import { USABLE_SCAN_STATUSES } from "@/lib/scans/status";
import { myBusinessInfo } from "@/lib/providers/dataforseo";
import { domainFromUrl } from "@/lib/providers/dataforseo/match-target";
import {
  fetchReferringDomains,
  fetchSampleBacklink,
  type ReferringDomainItem,
} from "@/lib/providers/dataforseo/backlinks";
import { normalizeDomain } from "@/lib/backlink-gap/domain";
import { classifySourceType } from "@/lib/backlink-gap/classify";
import { isObviousSpam } from "@/lib/backlink-gap/spam-filter";
import { assessTopicalFit } from "@/lib/backlink-gap/power";
import { scoreOpportunity } from "@/lib/backlink-gap/score";
import {
  fallbackBacklinkGapTasks,
  generateBacklinkGapAnalysis,
} from "@/lib/providers/deepseek/backlink-gap";

const CONCURRENCY = 3;
const SAMPLE_BACKLINK_LIMIT = 25;
const INSERT_CHUNK_SIZE = 100;

const OPPORTUNITY_LIST_FIELDS =
  "id, referring_domain, source_url, source_title, source_type, domain_rank, authority_score, competitor_count, linked_competitors, target_has_link, anchor_text, dofollow, first_seen, last_seen, opportunity_score, priority, suggested_action, reason, status, topical_fit";

async function insertInChunks(
  supabase: ReturnType<typeof createServiceClient>,
  table: "backlink_gap_opportunities" | "backlink_gap_tasks",
  rows: Record<string, unknown>[]
) {
  for (let i = 0; i < rows.length; i += INSERT_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + INSERT_CHUNK_SIZE);
    const { error } = await supabase.from(table).insert(chunk);
    if (error) throw new Error(`Failed to save ${table}: ${error.message}`);
  }
}

async function loadBusinessContext(businessId: string) {
  const supabase = createServiceClient();
  const { data: business } = await supabase
    .from("businesses")
    .select("primary_category")
    .eq("id", businessId)
    .maybeSingle();
  const { data: keywords } = await supabase.from("business_keywords").select("*").eq("business_id", businessId);
  const primaryKw = keywords?.find((k) => k.is_primary) ?? keywords?.[0];
  return {
    category: business?.primary_category ?? null,
    keyword: primaryKw?.keyword ?? null,
    city: primaryKw?.city ?? null,
  };
}

export async function getLatestBacklinkGapRunId(businessId: string): Promise<string | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("backlink_gap_runs")
    .select("id")
    .eq("business_id", businessId)
    .in("status", ["ready", "partial"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

export type SelectedCompetitor = {
  id: string;
  name: string;
  domain: string | null;
  place_id?: string | null;
  cid?: string | null;
};

export type BacklinkGapResult = {
  runId: string;
  status: string;
  summary: string | null;
  targetDomain: string;
  targetRefDomainCount: number;
  competitorRefDomainCount: number;
  missingOpportunityCount: number;
  highPriorityCount: number;
  warnings: string[];
  fromCache?: boolean;
};

async function updateProgress(runId: string, stage: string) {
  const supabase = createServiceClient();
  await supabase.from("backlink_gap_runs").update({ progress_stage: stage }).eq("id", runId);
}

function extractCity(business: Record<string, unknown>, keywords: Array<{ city?: string | null }>): string | null {
  const kwCity = keywords.find((k) => k.city)?.city;
  if (kwCity) return kwCity;
  const addr = String(business.address_text ?? "");
  const m = addr.match(/,\s*([^,]+),\s*[A-Z]{2}\s*\d{5}/i);
  return m?.[1]?.trim() ?? null;
}

async function resolveCompetitorDomain(
  comp: { name?: string; cid?: string; place_id?: string },
  city: string | null,
  state: string | null,
  organizationId: string,
  businessLat?: number | null,
  businessLng?: number | null
): Promise<string | null> {
  const supabase = createServiceClient();

  if (comp.place_id) {
    const { data } = await supabase.from("competitors").select("website_url").eq("place_id", comp.place_id).maybeSingle();
    const d = domainFromUrl(data?.website_url);
    if (d) return d;
  }
  if (comp.cid) {
    const { data } = await supabase.from("competitors").select("website_url").eq("cid", comp.cid).maybeSingle();
    const d = domainFromUrl(data?.website_url);
    if (d) return d;
  }

  try {
    const items = await myBusinessInfo({
      keyword: comp.name ?? "competitor",
      placeId: comp.place_id ?? null,
      cid: comp.cid ?? null,
      city,
      state,
      lat: businessLat,
      lng: businessLng,
      organizationId,
    });
    const match =
      items.find((i) => comp.place_id && i.place_id === comp.place_id) ??
      items.find((i) => comp.cid && i.cid === comp.cid) ??
      items[0];
    return domainFromUrl(match?.url) ?? null;
  } catch {
    return null;
  }
}

function localIndustryFit(domain: string, city: string | null, category: string | null): { local: boolean; industry: boolean } {
  const d = domain.toLowerCase();
  const cityToken = city?.toLowerCase().replace(/[^a-z]/g, "") ?? "";
  const local = !!cityToken && d.includes(cityToken);
  const cat = (category ?? "").toLowerCase();
  const industry =
    !!cat &&
    (d.includes(cat.split(/\s+/)[0] ?? "") ||
      /contractor|service|plumb|hvac|roof|removal|junk|clean/i.test(d + " " + cat));
  return { local, industry };
}

export async function runBacklinkGap(params: {
  businessId: string;
  organizationId: string;
  scanBatchId?: string;
  competitorLimit?: number;
  selectedCompetitorIds?: string[];
  forceRefresh?: boolean;
}): Promise<BacklinkGapResult> {
  const supabase = createServiceClient();
  const warnings: string[] = [];
  const competitorLimit = params.competitorLimit ?? 5;

  const { data: business } = await supabase.from("businesses").select("*").eq("id", params.businessId).single();
  if (!business) throw new Error("Business not found");

  const targetDomain = normalizeDomain(business.website_url as string | null);
  if (!targetDomain) throw new Error("Business website URL is required for backlink gap analysis");

  if (!params.forceRefresh) {
    const { data: recent } = await supabase
      .from("backlink_gap_runs")
      .select("id, status, created_at")
      .eq("business_id", params.businessId)
      .in("status", ["ready", "partial"])
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recent) {
      const loaded = await loadLatestBacklinkGapRun(params.businessId);
      return {
        runId: recent.id,
        status: (recent.status as "ready" | "partial") ?? "ready",
        summary: (loaded?.run.ai_summary as string) ?? null,
        targetDomain,
        targetRefDomainCount: (loaded?.run.target_ref_domain_count as number) ?? 0,
        competitorRefDomainCount: (loaded?.run.competitor_ref_domain_count as number) ?? 0,
        missingOpportunityCount: (loaded?.run.missing_opportunity_count as number) ?? 0,
        highPriorityCount: (loaded?.run.high_priority_count as number) ?? 0,
        warnings: ["Returned recent run from last 24 hours"],
        fromCache: true,
      };
    }
  }

  const { data: keywords } = await supabase.from("business_keywords").select("*").eq("business_id", params.businessId);
  const primaryKw = keywords?.find((k) => k.is_primary) ?? keywords?.[0];
  const city = extractCity(business, keywords ?? []);
  const state = primaryKw?.state ?? null;

  let scanBatchId = params.scanBatchId ?? null;
  if (scanBatchId) {
    await assertScanBelongsToBusiness(scanBatchId, params.businessId);
  } else {
    const { data: latestScan } = await supabase
      .from("scan_batches")
      .select("id")
      .eq("business_id", params.businessId)
      .in("status", [...USABLE_SCAN_STATUSES])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    scanBatchId = latestScan?.id ?? null;
  }

  const { data: runRow } = await supabase
    .from("backlink_gap_runs")
    .insert({
      organization_id: params.organizationId,
      business_id: params.businessId,
      scan_batch_id: scanBatchId,
      status: "running",
      target_domain: targetDomain,
      competitor_limit: competitorLimit,
      progress_stage: "Loading competitors",
    })
    .select("id")
    .single();

  const runId = runRow!.id as string;

  try {
    await updateProgress(runId, "Loading competitors");

    let gridCompetitors: Array<{ name?: string; cid?: string; place_id?: string }> = [];
    if (scanBatchId) {
      const { data: points } = await supabase.from("scan_points").select("id").eq("scan_batch_id", scanBatchId);
      const pointIds = (points ?? []).map((p) => p.id);
      const { data: results } = pointIds.length
        ? await supabase
            .from("scan_results")
            .select(SCAN_RESULT_COMPETITOR_COLUMNS)
            .in("scan_point_id", pointIds)
        : { data: [] };
      gridCompetitors = buildGridTopCompetitors(results ?? [], {
        excludeCid: business.cid,
        excludePlaceId: business.place_id,
        excludeName: business.name,
        targetCategory: business.primary_category,
        keyword: primaryKw?.keyword,
        limit: competitorLimit,
      });
    }

    if (!gridCompetitors.length) {
      warnings.push("No grid competitors found — run a rank grid scan first for best results.");
    }

    const selectedCompetitors: SelectedCompetitor[] = [];
    for (const comp of gridCompetitors) {
      const domain = await resolveCompetitorDomain(
        comp,
        city,
        state,
        params.organizationId,
        business.lat as number | null,
        business.lng as number | null
      );
      if (!domain) {
        warnings.push(`Could not resolve website for competitor: ${comp.name ?? "Unknown"}`);
        continue;
      }
      if (domain === targetDomain) continue;
      selectedCompetitors.push({
        id: comp.place_id ?? comp.cid ?? comp.name ?? domain,
        name: comp.name ?? "Competitor",
        domain,
        place_id: comp.place_id,
        cid: comp.cid,
      });
    }

    if (!selectedCompetitors.length && gridCompetitors.length) {
      warnings.push("Competitors found in grid but none had resolvable website domains.");
    }

    await supabase
      .from("backlink_gap_runs")
      .update({ selected_competitors: selectedCompetitors })
      .eq("id", runId);

    await updateProgress(runId, "Fetching target backlinks");
    const targetRefs = await fetchReferringDomains({
      target: targetDomain,
      organizationId: params.organizationId,
    });
    const targetSet = new Set(targetRefs.items.map((i) => i.domain));

    await updateProgress(runId, "Fetching competitor backlinks");
    const limit = pLimit(CONCURRENCY);
    const competitorRefMaps = new Map<string, { comp: SelectedCompetitor; items: ReferringDomainItem[] }>();

    await Promise.all(
      selectedCompetitors.map((comp) =>
        limit(async () => {
          try {
            const refs = await fetchReferringDomains({
              target: comp.domain!,
              organizationId: params.organizationId,
            });
            competitorRefMaps.set(comp.id, { comp, items: refs.items });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            warnings.push(`Failed to fetch backlinks for ${comp.name} (${comp.domain}): ${msg}`);
          }
        })
      )
    );

    await updateProgress(runId, "Comparing domains");

    const domainToCompetitors = new Map<string, SelectedCompetitor[]>();
    const domainMeta = new Map<string, ReferringDomainItem>();

    for (const { comp, items } of competitorRefMaps.values()) {
      for (const item of items) {
        if (!item.domain || item.domain === targetDomain) continue;
        const existing = domainToCompetitors.get(item.domain) ?? [];
        if (!existing.some((c) => c.id === comp.id)) existing.push(comp);
        domainToCompetitors.set(item.domain, existing);
        const prev = domainMeta.get(item.domain);
        if (!prev || (item.rank ?? 0) > (prev.rank ?? 0)) {
          domainMeta.set(item.domain, item);
        }
      }
    }

    const gapDomains = [...domainToCompetitors.keys()].filter((d) => !targetSet.has(d));

    await updateProgress(runId, "Filtering spam");

    const competitorRefCount = new Set([...domainToCompetitors.keys()]).size;

    await updateProgress(runId, "Scoring opportunities");

    type ScoredOpp = {
      referring_domain: string;
      source_type: string;
      domain_rank: number | null;
      authority_score: number | null;
      competitor_count: number;
      linked_competitors: SelectedCompetitor[];
      target_has_link: boolean;
      opportunity_score: number;
      priority: string;
      suggested_action: string;
      reason: string;
      status: string;
      meta: ReferringDomainItem;
      dofollow: boolean | null;
      first_seen: string | null;
      source_url: string | null;
      source_title: string | null;
      anchor_text: string | null;
      last_seen: string | null;
    };

    const scored: ScoredOpp[] = [];

    for (const domain of gapDomains) {
      const linked = domainToCompetitors.get(domain) ?? [];
      const meta = domainMeta.get(domain)!;
      const spam = isObviousSpam(domain, { spamScore: meta.spamScore });
      const sourceType = classifySourceType(domain, {
        platformTypes: meta.platformTypes,
        isSpam: spam,
      });
      const fit = localIndustryFit(domain, city, business.primary_category as string | null);
      const dofollow =
        meta.referringPagesNofollow != null && meta.referringPagesNofollow === 0 ? true : null;

      const { score, priority, suggestedAction, reason } = scoreOpportunity({
        competitorCount: linked.length,
        totalCompetitors: selectedCompetitors.length || 1,
        domainRank: meta.rank,
        sourceType,
        dofollow,
        firstSeen: meta.firstSeen,
        isSpam: spam,
        localFit: fit.local,
        industryFit: fit.industry,
      });

      scored.push({
        referring_domain: domain,
        source_type: sourceType,
        domain_rank: meta.rank,
        authority_score: meta.rank != null ? Math.round((meta.rank / 1000) * 100) : null,
        competitor_count: linked.length,
        linked_competitors: linked,
        target_has_link: false,
        opportunity_score: score,
        priority,
        suggested_action: suggestedAction,
        reason,
        status: priority === "ignore" || spam ? "spam" : "open",
        meta,
        dofollow,
        first_seen: meta.firstSeen,
        source_url: null,
        source_title: null,
        anchor_text: null,
        last_seen: null,
      });
    }

    scored.sort((a, b) => (b.authority_score ?? 0) - (a.authority_score ?? 0));

    const bizContext = {
      category: business.primary_category as string | null,
      keyword: primaryKw?.keyword ?? null,
      city,
    };

    const sampleTargets = scored.filter((o) => o.priority !== "ignore" && o.status === "open").slice(0, SAMPLE_BACKLINK_LIMIT);
    await Promise.all(
      sampleTargets.map((opp) =>
        limit(async () => {
          const compDomain = opp.linked_competitors[0]?.domain ?? targetDomain;
          const sample = await fetchSampleBacklink({
            target: compDomain,
            referringDomain: opp.referring_domain,
            organizationId: params.organizationId,
          });
          if (!sample) return;
          opp.source_url = sample.sourceUrl;
          opp.source_title = sample.pageTitle;
          opp.anchor_text = sample.anchor;
          opp.dofollow = sample.dofollow ?? opp.dofollow;
          opp.first_seen = sample.firstSeen ?? opp.first_seen;
          opp.last_seen = sample.lastSeen;
        })
      )
    );

    await updateProgress(runId, "Generating tasks");

    const actionable = scored.filter((o) => o.status === "open");
    const highPriorityCount = actionable.filter((o) => o.priority === "high").length;

    const aiPayload = {
      target_domain: targetDomain,
      competitors: selectedCompetitors.map((c) => ({ name: c.name, domain: c.domain })),
      opportunities: actionable.slice(0, 30).map((o) => ({
        domain: o.referring_domain,
        type: o.source_type,
        score: o.opportunity_score,
        priority: o.priority,
        competitors: o.linked_competitors.map((c) => c.name),
        rank: o.domain_rank,
      })),
      ignored_count: scored.filter((o) => o.status === "spam").length,
    };

    const ai =
      (await generateBacklinkGapAnalysis({ payload: aiPayload, organizationId: params.organizationId })) ??
      fallbackBacklinkGapTasks(
        actionable.map((o) => ({
          referring_domain: o.referring_domain,
          priority: o.priority,
          suggested_action: o.suggested_action,
        }))
      );

    const opportunityRows = scored.map((o) => {
      const topicalFit = assessTopicalFit({
        anchor: o.anchor_text,
        title: o.source_title,
        domain: o.referring_domain,
        sourceType: o.source_type,
        category: bizContext.category,
        keyword: bizContext.keyword,
        city: bizContext.city,
      });
      return {
        run_id: runId,
        organization_id: params.organizationId,
        business_id: params.businessId,
        referring_domain: o.referring_domain,
        source_url: o.source_url,
        source_title: o.source_title,
        source_type: o.source_type,
        domain_rank: o.domain_rank,
        authority_score: o.authority_score,
        competitor_count: o.competitor_count,
        linked_competitors: o.linked_competitors.map((c) => ({ name: c.name, domain: c.domain })),
        target_has_link: o.target_has_link,
        anchor_text: o.anchor_text,
        dofollow: o.dofollow,
        first_seen: o.first_seen,
        last_seen: o.last_seen,
        opportunity_score: o.opportunity_score,
        priority: o.priority,
        suggested_action: o.suggested_action,
        reason: o.reason,
        status: o.status,
        topical_fit: topicalFit,
        raw_json: { ...o.meta.raw, topical_fit: topicalFit, dfs_rank: o.domain_rank },
      };
    });

    if (opportunityRows.length) {
      await insertInChunks(supabase, "backlink_gap_opportunities", opportunityRows);
    }

    const { data: insertedOpps } = await supabase
      .from("backlink_gap_opportunities")
      .select("id, referring_domain")
      .eq("run_id", runId);

    const oppByDomain = new Map((insertedOpps ?? []).map((o) => [o.referring_domain, o.id]));

    const taskRows = ai.tasks.map((t) => ({
      run_id: runId,
      organization_id: params.organizationId,
      business_id: params.businessId,
      opportunity_id: t.referring_domain ? oppByDomain.get(t.referring_domain) ?? null : null,
      title: t.title,
      description: t.description,
      priority: t.priority,
      impact: t.impact,
      effort: t.effort,
      status: "open",
      evidence_json: { evidence: t.evidence },
    }));

    if (taskRows.length) await insertInChunks(supabase, "backlink_gap_tasks", taskRows);

    const status = warnings.length ? "partial" : "ready";

    await supabase
      .from("backlink_gap_runs")
      .update({
        status,
        target_ref_domain_count: targetRefs.items.length,
        competitor_ref_domain_count: competitorRefCount,
        missing_opportunity_count: actionable.length,
        high_priority_count: highPriorityCount,
        ai_summary: ai.summary,
        progress_stage: null,
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);

    return {
      runId,
      status,
      summary: ai.summary,
      targetDomain,
      targetRefDomainCount: targetRefs.items.length,
      competitorRefDomainCount: competitorRefCount,
      missingOpportunityCount: actionable.length,
      highPriorityCount,
      warnings,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Backlink gap analysis failed";
    await supabase
      .from("backlink_gap_runs")
      .update({ status: "failed", error_message: message, finished_at: new Date().toISOString(), progress_stage: null })
      .eq("id", runId);
    throw err;
  }
}

export function buildCompetitorMatrix(params: {
  targetDomain: string;
  competitors: SelectedCompetitor[];
  opportunities: Array<{
    referring_domain: string;
    linked_competitors: Array<{ name?: string; domain?: string | null }>;
    target_has_link: boolean;
    authority_score?: number | null;
    domain_rank?: number | null;
    source_type?: string;
    competitor_count?: number;
  }>;
  targetReferringDomains?: string[];
}) {
  const compDomains = params.competitors.map((c) => ({ name: c.name, domain: c.domain }));
  const targetSet = new Set(params.targetReferringDomains ?? []);

  return params.opportunities.map((opp) => {
    const linkedNames = new Set((opp.linked_competitors ?? []).map((c) => c.name).filter(Boolean));
    const row: Record<string, boolean | string | number | null> = {
      domain: opp.referring_domain,
      you: opp.target_has_link || targetSet.has(opp.referring_domain),
      authority_score: opp.authority_score ?? null,
      domain_rank: opp.domain_rank ?? null,
      source_type: opp.source_type ?? "Unknown",
      competitor_count: opp.competitor_count ?? 0,
    };
    for (const comp of compDomains) {
      row[comp.name] = linkedNames.has(comp.name);
    }
    return row;
  });
}

export async function loadLatestBacklinkGapRun(businessId: string) {
  const supabase = createServiceClient();
  const { data: run } = await supabase
    .from("backlink_gap_runs")
    .select("*")
    .eq("business_id", businessId)
    .in("status", ["ready", "partial"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!run) return null;

  const context = await loadBusinessContext(businessId);
  const competitors = (run.selected_competitors as SelectedCompetitor[]) ?? [];

  const { data: tasks } = await supabase
    .from("backlink_gap_tasks")
    .select("*")
    .eq("run_id", run.id)
    .order("priority");

  return {
    run,
    opportunities: [] as Record<string, unknown>[],
    tasks: tasks ?? [],
    matrix: [] as Array<Record<string, boolean | string>>,
    competitors,
    context,
  };
}

export type OpportunityQueryParams = {
  businessId: string;
  page?: number;
  pageSize?: number;
  status?: "open" | "ignored" | "all";
  competitorName?: string | null;
  linkFilter?: "all" | "dofollow" | "nofollow";
  topicalFilter?: "all" | "topical" | "random";
  priorityFilter?: "all" | "high" | "medium" | "low";
};

export async function queryBacklinkGapOpportunities(params: OpportunityQueryParams) {
  const supabase = createServiceClient();
  const runId = await getLatestBacklinkGapRunId(params.businessId);
  if (!runId) {
    return { items: [], total: 0, page: 1, pageSize: params.pageSize ?? 10, context: null };
  }

  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 10));
  const offset = (page - 1) * pageSize;

  let query = supabase
    .from("backlink_gap_opportunities")
    .select(OPPORTUNITY_LIST_FIELDS, { count: "exact" })
    .eq("run_id", runId);

  if (params.status === "open") {
    query = query.eq("status", "open");
  } else if (params.status === "ignored") {
    query = query.or("status.eq.ignored,status.eq.spam,priority.eq.ignore");
  }

  if (params.linkFilter === "dofollow") query = query.eq("dofollow", true);
  if (params.linkFilter === "nofollow") query = query.eq("dofollow", false);

  if (params.topicalFilter === "topical") {
    query = query.eq("topical_fit", "topical");
  } else if (params.topicalFilter === "random") {
    query = query.eq("topical_fit", "random");
  }

  if (params.priorityFilter && params.priorityFilter !== "all") {
    query = query.eq("priority", params.priorityFilter);
  }

  if (params.competitorName) {
    query = query.filter(
      "linked_competitors",
      "cs",
      JSON.stringify([{ name: params.competitorName }])
    );
  }

  const { data, count, error } = await query
    .order("authority_score", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) throw new Error(error.message);

  const context = await loadBusinessContext(params.businessId);

  return {
    items: data ?? [],
    total: count ?? 0,
    page,
    pageSize,
    context,
  };
}

export async function getCompetitorGapCounts(
  businessId: string,
  competitors: Array<{ name: string; domain?: string | null }>,
  status: "open" | "ignored" = "open"
) {
  const supabase = createServiceClient();
  const runId = await getLatestBacklinkGapRunId(businessId);
  if (!runId) return competitors.map((c) => ({ ...c, count: 0 }));

  const counts = await Promise.all(
    competitors.map(async (c) => {
      let q = supabase
        .from("backlink_gap_opportunities")
        .select("id", { count: "exact", head: true })
        .eq("run_id", runId)
        .filter("linked_competitors", "cs", JSON.stringify([{ name: c.name }]));

      if (status === "open") q = q.eq("status", "open");
      else q = q.or("status.eq.ignored,status.eq.spam,priority.eq.ignore");

      const { count } = await q;
      return { ...c, count: count ?? 0 };
    })
  );

  return counts;
}

export async function getBacklinkGapAnalytics(businessId: string) {
  const supabase = createServiceClient();
  const runId = await getLatestBacklinkGapRunId(businessId);
  if (!runId) return null;

  const { data: run } = await supabase
    .from("backlink_gap_runs")
    .select(
      "target_ref_domain_count, missing_opportunity_count, high_priority_count, selected_competitors"
    )
    .eq("id", runId)
    .single();

  if (!run) return null;

  const competitors = (run.selected_competitors as SelectedCompetitor[]) ?? [];
  const competitorTotal = Math.max(competitors.length, 1);

  const { data: openRows } = await supabase
    .from("backlink_gap_opportunities")
    .select("competitor_count, dofollow, authority_score, source_type, priority, topical_fit, status")
    .eq("run_id", runId)
    .eq("status", "open");

  const { data: ignoredRows } = await supabase
    .from("backlink_gap_opportunities")
    .select("id, status, priority")
    .eq("run_id", runId)
    .or("status.eq.ignored,status.eq.spam,priority.eq.ignore");

  let sharedByAll = 0;
  let sharedBySome = 0;
  let exclusive = 0;
  const linkTypes = { dofollow: 0, nofollow: 0, unknown: 0 };
  const priorities = { high: 0, medium: 0, low: 0 };
  const relevance = { high: 0, medium: 0, low: 0 };
  const sourceTypes: Record<string, number> = {};
  const powerBuckets = [
    { label: "0–9", count: 0 },
    { label: "10–19", count: 0 },
    { label: "20–29", count: 0 },
    { label: "30–39", count: 0 },
    { label: "40–49", count: 0 },
    { label: "50–59", count: 0 },
    { label: "60–69", count: 0 },
    { label: "70–79", count: 0 },
    { label: "80–89", count: 0 },
    { label: "90–100", count: 0 },
  ];

  for (const row of openRows ?? []) {
    const cc = Number(row.competitor_count ?? 0);
    if (cc >= competitorTotal) sharedByAll++;
    else if (cc > 1) sharedBySome++;
    else exclusive++;

    if (row.dofollow === true) linkTypes.dofollow++;
    else if (row.dofollow === false) linkTypes.nofollow++;
    else linkTypes.unknown++;

    const p = String(row.priority ?? "low");
    if (p === "high") priorities.high++;
    else if (p === "medium") priorities.medium++;
    else priorities.low++;

    const topical = (row as { topical_fit?: string | null }).topical_fit;
    if (topical === "topical") relevance.high++;
    else if (topical === "random") relevance.low++;
    else relevance.medium++;

    const st = String(row.source_type ?? "Unknown");
    sourceTypes[st] = (sourceTypes[st] ?? 0) + 1;

    const power = row.authority_score != null ? Number(row.authority_score) : 0;
    const idx = Math.min(9, Math.floor(power / 10));
    powerBuckets[idx].count++;
  }

  const onlyToYou = Number(run.target_ref_domain_count ?? 0);
  const ignored = ignoredRows ?? [];
  const ignoredStats = {
    ignored: ignored.filter((r) => r.status === "ignored" || r.priority === "ignore").length,
    spam: ignored.filter((r) => r.status === "spam").length,
    review: ignored.filter((r) => r.status === "ignored").length,
  };

  const topCompetitorCounts = await getCompetitorGapCounts(businessId, competitors, "open");
  const topCompetitor = [...topCompetitorCounts].sort((a, b) => b.count - a.count)[0] ?? null;

  return {
    matrixDistribution: {
      total: Number(run.missing_opportunity_count ?? 0) + onlyToYou,
      sharedByAll,
      sharedBySome,
      exclusive,
      onlyToYou,
    },
    linkTypes,
    priorities,
    relevance,
    sourceTypes: Object.entries(sourceTypes)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    powerBuckets,
    ignoredStats: {
      ignored: ignored.length,
      spam: ignoredStats.spam,
      restored: 0,
      review: ignoredStats.review,
    },
    topCompetitor,
  };
}

export async function queryBacklinkGapMatrix(params: {
  businessId: string;
  page?: number;
  pageSize?: number;
}) {
  const supabase = createServiceClient();
  const runId = await getLatestBacklinkGapRunId(params.businessId);
  if (!runId) return { rows: [], total: 0, competitors: [] as SelectedCompetitor[] };

  const { data: run } = await supabase
    .from("backlink_gap_runs")
    .select("target_domain, selected_competitors")
    .eq("id", runId)
    .single();

  const competitors = (run?.selected_competitors as SelectedCompetitor[]) ?? [];
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 10));
  const offset = (page - 1) * pageSize;

  const { data, count, error } = await supabase
    .from("backlink_gap_opportunities")
    .select(
      "referring_domain, linked_competitors, target_has_link, authority_score, domain_rank, source_type, competitor_count",
      { count: "exact" }
    )
    .eq("run_id", runId)
    .eq("status", "open")
    .gte("competitor_count", 2)
    .order("competitor_count", { ascending: false })
    .order("authority_score", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) throw new Error(error.message);

  const matrix = buildCompetitorMatrix({
    targetDomain: run?.target_domain as string,
    competitors,
    opportunities: data ?? [],
  });

  return { rows: matrix, total: count ?? 0, page, pageSize, competitors };
}

export async function getBacklinkGapOpportunityById(businessId: string, opportunityId: string) {
  const supabase = createServiceClient();
  const runId = await getLatestBacklinkGapRunId(businessId);
  if (!runId) return null;

  const { data } = await supabase
    .from("backlink_gap_opportunities")
    .select(OPPORTUNITY_LIST_FIELDS)
    .eq("run_id", runId)
    .eq("id", opportunityId)
    .maybeSingle();

  return data;
}

export async function createBacklinkGapTasks(params: {
  businessId: string;
  organizationId: string;
  opportunityIds?: string[];
}) {
  const supabase = createServiceClient();
  const latest = await loadLatestBacklinkGapRun(params.businessId);
  if (!latest?.run) throw new Error("No backlink gap run found");

  const runId = latest.run.id as string;

  const { data: existing } = await supabase.from("backlink_gap_tasks").select("id").eq("run_id", runId);
  if (existing?.length && !params.opportunityIds?.length) return existing;

  let opps: Array<Record<string, unknown>> = [];
  if (params.opportunityIds?.length) {
    const { data } = await supabase
      .from("backlink_gap_opportunities")
      .select("id, referring_domain, priority, suggested_action")
      .eq("run_id", runId)
      .in("id", params.opportunityIds);
    opps = data ?? [];
  } else {
    const { data } = await supabase
      .from("backlink_gap_opportunities")
      .select("id, referring_domain, priority, suggested_action")
      .eq("run_id", runId)
      .in("priority", ["high", "medium"])
      .eq("status", "open")
      .order("authority_score", { ascending: false })
      .limit(10);
    opps = data ?? [];
  }

  const ai = fallbackBacklinkGapTasks(
    opps.map((o) => ({
      referring_domain: o.referring_domain as string,
      priority: o.priority as string,
      suggested_action: o.suggested_action as string | null,
    }))
  );

  const rows = ai.tasks.map((t) => ({
    run_id: runId,
    organization_id: params.organizationId,
    business_id: params.businessId,
    opportunity_id: opps.find((o) => o.referring_domain === t.referring_domain)?.id ?? null,
    title: t.title,
    description: t.description,
    priority: t.priority,
    impact: t.impact,
    effort: t.effort,
    status: "open",
    evidence_json: { evidence: t.evidence, summary: latest.run.ai_summary },
  }));

  const { data: inserted } = await supabase.from("backlink_gap_tasks").insert(rows).select("*");
  return inserted ?? [];
}

export async function updateOpportunityStatus(
  opportunityId: string,
  status: "open" | "ignored" | "completed" | "spam",
  businessId: string,
  organizationId?: string
) {
  const supabase = createServiceClient();
  let query = supabase
    .from("backlink_gap_opportunities")
    .update({ status })
    .eq("id", opportunityId)
    .eq("business_id", businessId);
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data, error } = await query.select("id").maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Opportunity not found or access denied");
}
