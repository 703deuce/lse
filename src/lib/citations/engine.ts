import { createServiceClient } from "@/lib/db/client";
import { buildGridTopCompetitors } from "@/lib/maps/grid";
import {
  buildDiscoveryQueries,
  buildSiteQueries,
  matchHitToSource,
  searchCitations,
  type SearchHit,
} from "@/lib/citations/discover";
import {
  addressMatchScore,
  classifyNapStatus,
  detectNapIssues,
  domainsMatch,
  nameMatchScore,
  normalizePhone,
  phonesMatch,
  type NapIssue,
} from "@/lib/citations/nap-match";
import { parseCitationPage } from "@/lib/citations/parse-page";
import { computeCitationHealthScore } from "@/lib/citations/score";
import {
  detectVertical,
  sourcesForVertical,
  suggestedSearchUrl,
  type CitationSource,
} from "@/lib/citations/sources";
import {
  fallbackCitationTasks,
  generateCitationAnalysis,
} from "@/lib/providers/deepseek/citations";

const MAX_PAGE_FETCHES = 18;
const COMPETITOR_SITE_LIMIT = 8;

export type CitationAuditResult = {
  auditId: string;
  status: string;
  score: number;
  foundCount: number;
  missingCount: number;
  napIssueCount: number;
  competitorGapCount: number;
  aiSummary: string | null;
  warnings: string[];
  listings: Array<Record<string, unknown>>;
  missing: Array<Record<string, unknown>>;
  napIssues: NapIssue[];
  competitorPresence: Array<Record<string, unknown>>;
  tasks: Array<Record<string, unknown>>;
  hasCompetitors: boolean;
};

async function updateProgress(auditId: string, stage: string) {
  const supabase = createServiceClient();
  await supabase.from("citation_audits").update({ progress_stage: stage }).eq("id", auditId);
}

async function loadSources(): Promise<CitationSource[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("citation_sources")
    .select("*")
    .eq("active", true)
    .order("priority");

  if (data?.length) {
    return data.map((r) => ({
      name: r.name as string,
      domain: r.domain as string,
      sourceType: r.source_type as string,
      vertical: r.vertical as string,
      priority: r.priority as "high" | "medium" | "low",
    }));
  }

  return [
    { name: "Yelp", domain: "yelp.com", sourceType: "general", vertical: "all", priority: "high" },
    { name: "BBB", domain: "bbb.org", sourceType: "trust", vertical: "all", priority: "high" },
    { name: "Facebook", domain: "facebook.com", sourceType: "social", vertical: "all", priority: "high" },
  ];
}

function extractCity(business: Record<string, unknown>, keywords: Array<{ city?: string | null }>): string | null {
  const kwCity = keywords.find((k) => k.city)?.city;
  if (kwCity) return kwCity;
  const addr = String(business.address_text ?? "");
  const m = addr.match(/,\s*([^,]+),\s*[A-Z]{2}\s*\d{5}/i);
  return m?.[1]?.trim() ?? null;
}

export async function runCitationAudit(params: {
  businessId: string;
  organizationId: string;
  competitorLimit?: number;
  vertical?: string;
  forceRefresh?: boolean;
}): Promise<CitationAuditResult> {
  const supabase = createServiceClient();
  const warnings: string[] = [];
  const competitorLimit = params.competitorLimit ?? 5;

  const { data: business } = await supabase.from("businesses").select("*").eq("id", params.businessId).single();
  if (!business) throw new Error("Business not found");

  const { data: keywords } = await supabase.from("business_keywords").select("*").eq("business_id", params.businessId);
  const primaryKw = keywords?.find((k) => k.is_primary) ?? keywords?.[0];
  const vertical = (params.vertical as "general" | "home_services" | "legal" | "medical") ??
    detectVertical(business.primary_category, primaryKw?.keyword);
  const city = extractCity(business, keywords ?? []);

  const { data: auditRow } = await supabase
    .from("citation_audits")
    .insert({
      organization_id: params.organizationId,
      business_id: params.businessId,
      status: "running",
      vertical,
      progress_stage: "Searching citations",
    })
    .select("id")
    .single();

  const auditId = auditRow!.id as string;

  try {
    const allSources = await loadSources();
    const sources = sourcesForVertical(allSources, vertical);
    const highPriorityDomains = sources.filter((s) => s.priority === "high").map((s) => s.domain);

    const expected = {
      name: business.name as string,
      address: business.address_text as string | null,
      phone: business.phone as string | null,
      website: business.website_url as string | null,
    };

    await updateProgress(auditId, "Searching citations");

    const hitMap = new Map<string, SearchHit>();
    const generalQueries = buildDiscoveryQueries({ ...expected, city });
    const siteQueries = buildSiteQueries(expected.name, sources.map((s) => s.domain));

    for (const q of [...generalQueries, ...siteQueries]) {
      const { hits, warning } = await searchCitations({ query: q, organizationId: params.organizationId });
      if (warning) warnings.push(warning);
      for (const hit of hits) {
        if (hit.url) hitMap.set(hit.url, hit);
      }
    }

    const foundByDomain = new Map<string, SearchHit>();
    for (const hit of hitMap.values()) {
      for (const src of sources) {
        if (matchHitToSource(hit, src.domain) && !foundByDomain.has(src.domain)) {
          foundByDomain.set(src.domain, hit);
        }
      }
    }

    await updateProgress(auditId, "Checking NAP");

    const listings: Array<Record<string, unknown>> = [];
    let fetchCount = 0;

    for (const src of sources) {
      const hit = foundByDomain.get(src.domain);
      const listingUrl = hit?.url ?? null;
      let parsed = { name: null as string | null, address: null as string | null, phone: null as string | null, website: null as string | null, excerpt: "", schemaFound: false, title: null as string | null };
      let verified = false;
      let confidence: "high" | "medium" | "low" = "low";

      if (listingUrl && fetchCount < MAX_PAGE_FETCHES) {
        fetchCount++;
        parsed = await parseCitationPage(listingUrl, params.organizationId);
        verified = !!(parsed.name || parsed.phone || parsed.address || parsed.schemaFound);
        confidence = parsed.schemaFound ? "high" : verified ? "medium" : "low";
      } else if (hit) {
        verified = false;
        confidence = "low";
        parsed.name = hit.title || null;
      }

      const nameScore = nameMatchScore(expected.name, parsed.name ?? hit?.title);
      const addressScore = addressMatchScore(expected.address, parsed.address);
      const phoneMatch = phonesMatch(expected.phone, parsed.phone);
      const websiteMatch = domainsMatch(expected.website, parsed.website ?? listingUrl);
      const napStatus = hit
        ? classifyNapStatus({
            nameScore,
            addressScore,
            phoneMatch,
            websiteMatch,
            hasParsedData: verified,
            verified,
          })
        : "unverified";

      if (hit) {
        listings.push({
          audit_id: auditId,
          organization_id: params.organizationId,
          business_id: params.businessId,
          source_name: src.name,
          source_domain: src.domain,
          listing_url: listingUrl,
          found: true,
          name_found: parsed.name ?? hit.title,
          address_found: parsed.address,
          phone_found: parsed.phone,
          website_found: parsed.website,
          expected_name: expected.name,
          expected_address: expected.address,
          expected_phone: expected.phone,
          expected_website: expected.website,
          name_match_score: nameScore,
          address_match_score: addressScore,
          phone_match_score: phoneMatch ? 100 : 0,
          website_match_score: websiteMatch ? 100 : 0,
          nap_status: napStatus,
          confidence,
          raw_html_excerpt: parsed.excerpt?.slice(0, 500),
          raw_json: { hit, schemaFound: parsed.schemaFound },
        });
      }
    }

    const foundDomains = new Set(listings.map((l) => l.source_domain as string));
    const missingRows: Array<Record<string, unknown>> = [];

    for (const src of sources) {
      if (foundDomains.has(src.domain)) continue;
      missingRows.push({
        audit_id: auditId,
        organization_id: params.organizationId,
        business_id: params.businessId,
        source_name: src.name,
        source_domain: src.domain,
        priority: src.priority,
        reason: `No listing found on ${src.name}`,
        competitor_count: 0,
        suggested_search_url: suggestedSearchUrl(src.domain, expected.name),
        status: "open",
      });
    }

    const napIssues: NapIssue[] = [];
    for (const l of listings) {
      napIssues.push(...detectNapIssues(l as Parameters<typeof detectNapIssues>[0]));
    }

    await updateProgress(auditId, "Comparing competitors");

    const { data: latestScan } = await supabase
      .from("scan_batches")
      .select("id")
      .eq("business_id", params.businessId)
      .eq("status", "ready")
      .order("finished_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let competitors: Array<{ name?: string; cid?: string; place_id?: string }> = [];
    if (latestScan) {
      const { data: points } = await supabase.from("scan_points").select("id").eq("scan_batch_id", latestScan.id);
      const pointIds = (points ?? []).map((p) => p.id);
      const { data: results } = pointIds.length
        ? await supabase.from("scan_results").select("*").in("scan_point_id", pointIds)
        : { data: [] };
      competitors = buildGridTopCompetitors(results ?? [], {
        excludeCid: business.cid,
        excludePlaceId: business.place_id,
        excludeName: business.name,
        targetCategory: business.primary_category,
        keyword: primaryKw?.keyword,
        limit: competitorLimit,
      });
    }

    const competitorPresence: Array<Record<string, unknown>> = [];
    const competitorGapDomains = new Set<string>();
    const gapSourceDomains = highPriorityDomains.slice(0, COMPETITOR_SITE_LIMIT);

    for (const comp of competitors) {
      const compName = comp.name ?? "Competitor";
      for (const domain of gapSourceDomains) {
        const src = sources.find((s) => s.domain === domain);
        if (!src) continue;
        const targetHas = foundDomains.has(domain);
        let compListed = false;
        let compUrl: string | null = null;

        if (!targetHas) {
          const { hits } = await searchCitations({
            query: `"${compName}" site:${domain}`,
            organizationId: params.organizationId,
          });
          if (hits.length) {
            compListed = true;
            compUrl = hits[0].url;
          }
        }

        competitorPresence.push({
          audit_id: auditId,
          organization_id: params.organizationId,
          competitor_name: compName,
          source_name: src.name,
          source_domain: domain,
          listed: compListed,
          listing_url: compUrl,
        });

        if (compListed && !targetHas) {
          competitorGapDomains.add(domain);
          const missing = missingRows.find((m) => m.source_domain === domain);
          if (missing) {
            missing.competitor_count = ((missing.competitor_count as number) ?? 0) + 1;
            missing.reason = `${(missing.competitor_count as number)} competitors listed on ${src.name}; you are not.`;
            if (src.priority === "high") missing.priority = "high";
          }
        }
      }
    }

    await updateProgress(auditId, "Generating tasks");

    const score = computeCitationHealthScore({
      sources,
      foundDomains,
      listings: listings as Array<{ nap_status: "match" | "partial" | "mismatch" | "missing_data" | "unverified"; confidence: string; source_domain?: string | null }>,
      missingHighPriority: missingRows.filter((m) => m.priority === "high").length,
      competitorGaps: competitorGapDomains.size,
      totalHighPriority: highPriorityDomains.length,
    });

    const aiPayload = {
      business: expected,
      score,
      found: listings.map((l) => ({ source: l.source_name, nap: l.nap_status, url: l.listing_url })),
      missing: missingRows.map((m) => ({ source: m.source_name, priority: m.priority, reason: m.reason })),
      nap_issues: napIssues,
      competitor_gaps: [...competitorGapDomains],
    };

    const ai = (await generateCitationAnalysis({ payload: aiPayload, organizationId: params.organizationId })) ??
      fallbackCitationTasks(
        missingRows.map((m) => m.source_name as string),
        napIssues.map((i) => `${i.source}: ${i.issueType}`)
      );

    const taskRows = ai.tasks.map((t) => ({
      audit_id: auditId,
      organization_id: params.organizationId,
      business_id: params.businessId,
      title: t.title,
      description: t.description,
      priority: t.priority,
      impact: t.impact,
      effort: t.effort,
      status: "open",
      evidence_json: { evidence: t.evidence },
    }));

    if (listings.length) await supabase.from("citation_listings").insert(listings);
    if (missingRows.length) await supabase.from("citation_missing").insert(missingRows);
    if (competitorPresence.length) await supabase.from("citation_competitor_presence").insert(competitorPresence);
    if (taskRows.length) await supabase.from("citation_tasks").insert(taskRows);

    await supabase
      .from("citation_audits")
      .update({
        status: warnings.length ? "partial" : "ready",
        score,
        found_count: listings.length,
        missing_count: missingRows.length,
        nap_issue_count: napIssues.length,
        competitor_gap_count: competitorGapDomains.size,
        ai_summary: ai.summary,
        warnings,
        progress_stage: null,
        finished_at: new Date().toISOString(),
      })
      .eq("id", auditId);

    return {
      auditId,
      status: warnings.length ? "partial" : "ready",
      score,
      foundCount: listings.length,
      missingCount: missingRows.length,
      napIssueCount: napIssues.length,
      competitorGapCount: competitorGapDomains.size,
      aiSummary: ai.summary,
      warnings,
      listings,
      missing: missingRows,
      napIssues,
      competitorPresence,
      tasks: taskRows,
      hasCompetitors: competitors.length > 0,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Citation audit failed";
    await supabase
      .from("citation_audits")
      .update({ status: "failed", error_message: message, finished_at: new Date().toISOString() })
      .eq("id", auditId);
    throw err;
  }
}

export async function loadLatestCitationAudit(businessId: string) {
  const supabase = createServiceClient();
  const { data: audit } = await supabase
    .from("citation_audits")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!audit) return null;

  const [listings, missing, competitorPresence, tasks] = await Promise.all([
    supabase.from("citation_listings").select("*").eq("audit_id", audit.id).order("source_name"),
    supabase.from("citation_missing").select("*").eq("audit_id", audit.id).order("priority"),
    supabase.from("citation_competitor_presence").select("*").eq("audit_id", audit.id),
    supabase.from("citation_tasks").select("*").eq("audit_id", audit.id).order("priority"),
  ]);

  const napIssues: NapIssue[] = [];
  for (const l of listings.data ?? []) {
    napIssues.push(...detectNapIssues(l));
  }

  return {
    audit,
    listings: listings.data ?? [],
    missing: missing.data ?? [],
    competitorPresence: competitorPresence.data ?? [],
    tasks: tasks.data ?? [],
    napIssues,
    hasCompetitors: (competitorPresence.data ?? []).length > 0,
  };
}

export async function createCitationTasksFromAudit(auditId: string, businessId: string, organizationId: string) {
  const supabase = createServiceClient();
  const { data: existing } = await supabase.from("citation_tasks").select("id").eq("audit_id", auditId);
  if (existing?.length) return existing;

  const { data: audit } = await supabase.from("citation_audits").select("ai_summary").eq("id", auditId).single();
  const { data: missing } = await supabase.from("citation_missing").select("*").eq("audit_id", auditId).limit(5);
  const fallback = fallbackCitationTasks(
    (missing ?? []).map((m) => m.source_name as string),
    []
  );

  const rows = fallback.tasks.map((t) => ({
    audit_id: auditId,
    organization_id: organizationId,
    business_id: businessId,
    title: t.title,
    description: t.description,
    priority: t.priority,
    impact: t.impact,
    effort: t.effort,
    status: "open",
    evidence_json: { evidence: t.evidence, summary: audit?.ai_summary },
  }));

  const { data: inserted } = await supabase.from("citation_tasks").insert(rows).select("id");
  return inserted ?? [];
}
