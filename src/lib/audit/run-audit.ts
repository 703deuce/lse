import type { GbpProfile, LoadedCompetitor } from "@/lib/audit/types";
import { createServiceClient } from "@/lib/db/client";
import { runWebsiteMatchAudit } from "@/lib/audit/website-match";
import { runCategoryGapAudit } from "@/lib/audit/category-gap";
import { runCore30Audit } from "@/lib/audit/core30";
import { runHyperLocalAudit } from "@/lib/audit/hyperlocal";
import { runCompetitorGapAudit } from "@/lib/audit/competitor-gap";
import { buildActionPlanFromAudits } from "@/lib/audit/action-plan-engine";
import { enrichTargetBusiness } from "@/lib/jobs/enrich-competitors";
import { normalizePlaceTopics, normalizeStringList } from "@/lib/audit/json-fields";

export async function loadGbpProfile(businessId: string): Promise<GbpProfile | null> {
  const db = createServiceClient();
  const { data: biz } = await db.from("businesses").select("*").eq("id", businessId).single();
  if (!biz) return null;

  const { data: keywords } = await db.from("business_keywords").select("*").eq("business_id", businessId);
  const primaryKw = keywords?.find((k) => k.is_primary) ?? keywords?.[0];

  let enriched = {
    additional_categories: [] as string[],
    rating: undefined as number | undefined,
    review_count: undefined as number | undefined,
    photo_count: undefined as number | undefined,
    post_count: undefined as number | undefined,
    description: undefined as string | undefined,
  };

  try {
    const profile = await enrichTargetBusiness({
      name: biz.name,
      cid: biz.cid,
      placeId: biz.place_id,
      city: primaryKw?.city ?? undefined,
      state: primaryKw?.state ?? undefined,
      lat: biz.scan_center_lat ?? biz.lat,
      lng: biz.scan_center_lng ?? biz.lng,
    });
    enriched = {
      additional_categories: profile.additional_categories ?? [],
      rating: profile.rating,
      review_count: profile.review_count,
      photo_count: profile.photo_count,
      post_count: profile.post_count,
      description: profile.description,
    };
  } catch {
    /* use stored data only */
  }

  const services = [
    biz.primary_category,
    ...enriched.additional_categories,
  ].filter(Boolean) as string[];

  return {
    name: biz.name,
    address: biz.address_text,
    phone: biz.phone,
    website: biz.website_url,
    primaryCategory: biz.primary_category ?? enriched.additional_categories[0] ?? null,
    secondaryCategories: enriched.additional_categories,
    services,
    city: primaryKw?.city ?? null,
    state: primaryKw?.state ?? null,
    rating: enriched.rating,
    reviewCount: enriched.review_count,
    photoCount: enriched.photo_count,
    postCount: enriched.post_count,
    hoursText: null,
    description: enriched.description ?? null,
  };
}


export async function loadCompetitorsForBusiness(businessId: string): Promise<LoadedCompetitor[]> {
  const db = createServiceClient();
  const { data: biz } = await db
    .from("businesses")
    .select("name, cid, place_id")
    .eq("id", businessId)
    .maybeSingle();

  const { data: batch } = await db
    .from("scan_batches")
    .select("id")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!batch) return [];
  const competitors = await loadCompetitorsFromBatch(batch.id, biz ?? undefined);
  return competitors.slice(0, 20);
}

function isSameBusiness(
  competitor: LoadedCompetitor,
  biz: { name?: string; cid?: string | null; place_id?: string | null }
): boolean {
  if (biz.name && competitor.name.trim().toLowerCase() === biz.name.trim().toLowerCase()) {
    return true;
  }
  return false;
}

async function loadCompetitorsFromBatch(
  scanBatchId: string,
  biz?: { name?: string; cid?: string | null; place_id?: string | null }
) {
  const db = createServiceClient();

  const { data: snapshots } = await db
    .from("competitor_snapshots")
    .select("*, competitors(name, website_url)")
    .eq("scan_batch_id", scanBatchId)
    .order("review_count", { ascending: false })
    .limit(20);

  if (snapshots?.length) {
    return snapshots
      .map((s, i) => {
        const comp = s.competitors as { name?: string; website_url?: string } | null;
  const topics = normalizePlaceTopics(s.place_topics_json);
        const servicesJson = (s.services_json ?? {}) as Record<string, unknown>;
        const services = Object.keys(servicesJson).filter((k) => k && k.length > 2);
        return {
          name: comp?.name ?? "Unknown",
          rank: i + 1,
          category: s.category ?? undefined,
          additionalCategories: normalizeStringList(s.additional_categories),
          rating: s.rating ?? undefined,
          reviewCount: s.review_count ?? undefined,
          photoCount: s.photo_count ?? undefined,
          postCount: s.post_count ?? undefined,
          reviewKeywords: topics.slice(0, 15),
          serviceKeywords: topics,
          services,
          website: comp?.website_url ?? undefined,
        };
      })
      .filter((c) => !biz || !isSameBusiness(c, biz));
  }

  const { data: points } = await db.from("scan_points").select("id").eq("scan_batch_id", scanBatchId);
  const pointIds = (points ?? []).map((p) => p.id);
  if (!pointIds.length) return [];

  const { data: results } = await db
    .from("scan_results")
    .select("top_competitors_json")
    .in("scan_point_id", pointIds);

  const seen = new Set<string>();
  const competitors: LoadedCompetitor[] = [];

  for (const row of results ?? []) {
    const tops = row.top_competitors_json as Array<Record<string, unknown>>;
    for (const c of tops ?? []) {
      const name = String(c.title ?? c.name ?? "");
      if (!name || seen.has(name)) continue;
      if (biz?.name && name.trim().toLowerCase() === biz.name.trim().toLowerCase()) continue;
      seen.add(name);
      competitors.push({
        name,
        rank: Number(c.rank ?? c.position ?? competitors.length + 1),
        category: c.category as string | undefined,
        rating: Number(c.rating ?? 0),
        reviewCount: Number(c.reviews ?? c.review_count ?? 0),
        website: c.website as string | undefined,
      });
    }
  }
  return competitors.sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
}

export async function runFullAuditSuite(businessId: string, keyword?: string) {
  const gbp = await loadGbpProfile(businessId);
  if (!gbp) throw new Error("Business not found");

  const competitors = await loadCompetitorsForBusiness(businessId);
  const competitorCategories = competitors.flatMap((c) =>
    [c.category, ...(c.additionalCategories ?? [])].filter(Boolean) as string[]
  );

  const [website, categoryGap, core30, hyperlocal, competitorGap] = await Promise.all([
    gbp.website ? runWebsiteMatchAudit(gbp, keyword) : Promise.resolve({ checks: [], score: 0, pages: [] }),
    runCategoryGapAudit(gbp, competitorCategories, { competitors }),
    runCore30Audit(gbp),
    runHyperLocalAudit(gbp),
    runCompetitorGapAudit(gbp, competitors),
  ]);

  const actionPlan = buildActionPlanFromAudits({
    gbp,
    websiteChecks: website.checks,
    categoryGap,
    core30,
    hyperlocal: hyperlocal.opportunities,
    competitorGap,
  });

  return { gbp, website, categoryGap, core30, hyperlocal, competitorGap, actionPlan, competitors };
}

export async function saveAuditRun(
  businessId: string,
  moduleType: string,
  resultJson: unknown,
  score?: number
) {
  const db = createServiceClient();
  const { error } = await db.from("module_audits").insert({
    business_id: businessId,
    module_type: moduleType,
    result_json: resultJson,
    score,
  });
  if (error) {
    console.warn("module_audits save skipped:", error.message);
  }
}

export async function getLatestModuleAudit(businessId: string, moduleType: string) {
  const db = createServiceClient();
  const { data } = await db
    .from("module_audits")
    .select("*")
    .eq("business_id", businessId)
    .eq("module_type", moduleType)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}
