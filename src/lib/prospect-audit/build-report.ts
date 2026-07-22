import { createServiceClient } from "@/lib/db/client";
import { loadLatestGrowthAudit } from "@/lib/growth-audit/engine";
import type { GrowthAuditSections } from "@/lib/growth-audit/types";
import { rankHex, rankTextColor } from "@/lib/maps/colors";
import { loadScanGridData } from "@/lib/maps/scan-queries";
import { buildEntityGridCells, buildYouEntity, type StoredCompetitor } from "@/lib/maps/grid-entity";
import { kpisFromRanks, mapsUrlFromPlaceId, round1 } from "@/lib/reporting/metrics";
import type { HeatmapCell } from "@/lib/reporting/types";
import type {
  AuditFactorStatus,
  ProspectAuditCompetitor,
  ProspectAuditFactor,
  ProspectAuditKeywordGrid,
  ProspectAuditReport,
} from "@/lib/prospect-audit/types";

type ServiceClient = ReturnType<typeof createServiceClient>;

function factorStatus(
  score: number | null | undefined,
  checksGood: boolean | null
): { status: AuditFactorStatus; statusLabel: string } {
  if (checksGood === true || (score != null && score >= 70)) {
    return { status: "good", statusLabel: "Good" };
  }
  if (checksGood === false || (score != null && score < 50)) {
    return { status: "needs_attention", statusLabel: "Needs attention" };
  }
  if (score != null) {
    return { status: "manual_check", statusLabel: "Manual check" };
  }
  return { status: "unknown", statusLabel: "Not checked" };
}

function checkRatio(
  checks: Array<{ status: string }> | undefined
): boolean | null {
  if (!checks?.length) return null;
  const bad = checks.filter((c) => c.status === "missing" || c.status === "mismatch").length;
  const good = checks.filter((c) => c.status === "match").length;
  if (good / checks.length >= 0.7) return true;
  if (bad / checks.length >= 0.35) return false;
  return null;
}

function buildFactors(sections: GrowthAuditSections | null): ProspectAuditFactor[] {
  if (!sections) {
    return [
      "Keyword Density",
      "GMB Optimization",
      "Backlink Profile",
      "Mobile Friendly",
      "Page Speed",
      "Meta Descriptions",
      "Schema Markup",
      "Image Alt Tags",
      "Social Presence",
      "Security (SSL)",
      "NAP Consistency",
      "Local Citations",
    ].map((title, i) => ({
      id: `factor-${i}`,
      title,
      status: "unknown" as const,
      statusLabel: "Not checked",
      detail: null,
    }));
  }

  const gbp = sections.gbp;
  const website = sections.website;
  const coverage = sections.serviceCoverage;
  const competitors = sections.competitorGap;
  const sslCheck = website?.checks?.find((c) => /ssl|https|security/i.test(c.label));
  const mobileCheck = website?.checks?.find((c) => /mobile/i.test(c.label));
  const metaCheck = website?.checks?.find((c) => /meta/i.test(c.label));
  const schemaCheck = website?.checks?.find((c) => /schema/i.test(c.label));
  const altCheck = website?.checks?.find((c) => /alt|image/i.test(c.label));
  const speedCheck = website?.checks?.find((c) => /speed|performance/i.test(c.label));

  const rows: Array<{
    id: string;
    title: string;
    score?: number | null;
    good?: boolean | null;
    detail?: string | null;
  }> = [
    {
      id: "keyword-density",
      title: "Keyword Density",
      score: coverage?.score,
      good:
        coverage?.core30 != null
          ? coverage.core30.completionScore >= 60
          : checkRatio(undefined),
      detail: coverage ? `Coverage score ${coverage.score}` : null,
    },
    {
      id: "gmb",
      title: "GMB Optimization",
      score: gbp?.score,
      good: checkRatio(gbp?.checks),
      detail: gbp ? `GBP score ${gbp.score}` : null,
    },
    {
      id: "backlinks",
      title: "Backlink Profile",
      score: competitors?.score,
      good: (competitors?.score ?? 0) >= 60,
      detail: competitors ? `Competitor gap score ${competitors.score}` : null,
    },
    {
      id: "mobile",
      title: "Mobile Friendly",
      good:
        mobileCheck?.status === "match"
          ? true
          : mobileCheck
            ? false
            : null,
      detail: mobileCheck?.evidence ?? mobileCheck?.gbpValue ?? null,
    },
    {
      id: "speed",
      title: "Page Speed",
      good:
        speedCheck?.status === "match"
          ? true
          : speedCheck
            ? false
            : null,
      detail: speedCheck?.evidence ?? null,
    },
    {
      id: "meta",
      title: "Meta Descriptions",
      good:
        metaCheck?.status === "match"
          ? true
          : metaCheck
            ? false
            : null,
      detail: metaCheck?.evidence ?? null,
    },
    {
      id: "schema",
      title: "Schema Markup",
      good:
        schemaCheck?.status === "match"
          ? true
          : schemaCheck
            ? schemaCheck.status === "partial"
              ? null
              : false
            : null,
      detail: schemaCheck?.evidence ?? null,
    },
    {
      id: "alt",
      title: "Image Alt Tags",
      good:
        altCheck?.status === "match"
          ? true
          : altCheck
            ? altCheck.status === "partial"
              ? null
              : false
            : null,
      detail: altCheck?.evidence ?? null,
    },
    {
      id: "social",
      title: "Social Presence",
      score: sections.overview?.scanScores?.prominence ?? null,
      good: (sections.overview?.scanScores?.prominence ?? 0) >= 60,
      detail: null,
    },
    {
      id: "ssl",
      title: "Security (SSL)",
      good:
        sslCheck?.status === "match"
          ? true
          : sslCheck
            ? false
            : website?.checks?.length
              ? true
              : null,
      detail: sslCheck?.evidence ?? null,
    },
    {
      id: "nap",
      title: "NAP Consistency",
      score: website?.score,
      good: checkRatio(website?.checks),
      detail: website ? `Website match ${website.score}` : null,
    },
    {
      id: "citations",
      title: "Local Citations",
      score: sections.localCoverage?.score,
      good: (sections.localCoverage?.score ?? 0) >= 60,
      detail: sections.localCoverage
        ? `${sections.localCoverage.opportunities?.length ?? 0} local opportunities`
        : null,
    },
  ];

  return rows.map((r) => {
    const { status, statusLabel } = factorStatus(r.score, r.good ?? null);
    return {
      id: r.id,
      title: r.title,
      status,
      statusLabel,
      detail: r.detail ?? null,
    };
  });
}

function estimateMissedRevenue(params: {
  seoScore: number | null;
  avgRank: number | null;
  reviewCount: number | null;
  competitorReviews: number | null;
}): number {
  const scoreGap = Math.max(0, 100 - (params.seoScore ?? 40));
  const rankGap =
    params.avgRank != null && params.avgRank > 3
      ? (params.avgRank - 3) * 4200
      : params.avgRank == null
        ? 18000
        : 0;
  const reviewGap = Math.max(
    0,
    (params.competitorReviews ?? 200) - (params.reviewCount ?? 0)
  );
  const raw = scoreGap * 720 + rankGap + reviewGap * 85;
  return Math.round(raw / 100) * 100;
}

async function heatmapFromScan(
  supabase: ServiceClient,
  scanId: string
): Promise<{
  gridSize: number;
  cells: HeatmapCell[];
  averageRank: number | null;
  visibilityScore: number | null;
  keyword: string;
} | null> {
  try {
    const data = await loadScanGridData(supabase, scanId);
    if (!data?.batch) return null;
    const you = buildYouEntity(data.business ?? {});
    const cells = buildEntityGridCells(data.points, data.results, you);
    const ranks = cells.map((c) =>
      c.pending || c.notInResults || c.failed ? null : c.rank
    );
    const kpis = kpisFromRanks(ranks);
    const heatmapCells: HeatmapCell[] = [...cells]
      .sort((a, b) => a.row - b.row || a.col - b.col)
      .map((c) => {
        const rank =
          c.pending || c.notInResults || c.failed ? null : (c.rank as number | null);
        return {
          label: c.label,
          row: c.row,
          col: c.col,
          rank,
          color: rankHex(rank),
          textColor: rankTextColor(rankHex(rank)),
        };
      });
    const conf = (data.batch.confidence_summary ?? {}) as {
      keyword_label?: string;
      keyword?: string;
    };
    return {
      gridSize: Number(data.batch.grid_size ?? 5),
      cells: heatmapCells,
      averageRank: kpis.arp,
      visibilityScore: kpis.visibilityScore,
      keyword: String(conf.keyword_label || conf.keyword || "Keyword"),
    };
  } catch {
    return null;
  }
}

type ProspectAuditRow = {
  id: string;
  status: string;
  keywords: string[] | null;
  primary_keyword: string | null;
  growth_audit_run_id: string | null;
  scan_batch_ids: string[] | null;
  summary_json: Record<string, unknown> | null;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
};

export async function buildProspectAuditReport(
  businessId: string,
  opts?: { auditId?: string | null }
): Promise<ProspectAuditReport> {
  const supabase = createServiceClient();

  const { data: business } = await supabase
    .from("businesses")
    .select(
      "id, name, address_text, scan_center_label, phone, website_url, primary_category, scan_center_lat, scan_center_lng, organization_id, place_id, cid"
    )
    .eq("id", businessId)
    .maybeSingle();

  if (!business) {
    throw new Error("Business not found");
  }

  let auditRow: ProspectAuditRow | null = null;

  if (opts?.auditId) {
    const { data } = await supabase
      .from("prospect_audits")
      .select("*")
      .eq("id", opts.auditId)
      .eq("business_id", businessId)
      .maybeSingle();
    auditRow = (data as ProspectAuditRow | null) ?? null;
  } else {
    const { data } = await supabase
      .from("prospect_audits")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    auditRow = (data as ProspectAuditRow | null) ?? null;
  }

  const growth = await loadLatestGrowthAudit(businessId);
  const sections = (growth?.sections_json ?? null) as GrowthAuditSections | null;
  const seoScore =
    growth?.growth_score != null
      ? Number(growth.growth_score)
      : sections?.overview?.growthScore ?? null;

  const gbpProfile = sections?.gbp?.profile;
  const rating = gbpProfile?.rating ?? null;
  const reviewCount = gbpProfile?.reviewCount ?? null;

  // Keyword grids from audit scan ids, else latest ready scans for business
  const scanIds = (auditRow?.scan_batch_ids ?? []).filter(Boolean);
  let keywordGrids: ProspectAuditKeywordGrid[] = [];

  if (scanIds.length) {
    for (const sid of scanIds.slice(0, 3)) {
      const hm = await heatmapFromScan(supabase, sid);
      keywordGrids.push({
        keyword: hm?.keyword ?? "Keyword",
        scanId: sid,
        averageRank: hm?.averageRank ?? null,
        visibilityScore: hm?.visibilityScore ?? null,
        gridSize: hm?.gridSize ?? 5,
        cells: hm?.cells ?? [],
        status: hm ? "ready" : "running",
      });
    }
  } else {
    const { data: batches } = await supabase
      .from("scan_batches")
      .select("id, status, confidence_summary, created_at")
      .eq("business_id", businessId)
      .in("status", ["ready", "partial", "rank_ready"])
      .order("created_at", { ascending: false })
      .limit(3);
    for (const b of batches ?? []) {
      const hm = await heatmapFromScan(supabase, b.id);
      if (!hm) continue;
      keywordGrids.push({
        keyword: hm.keyword,
        scanId: b.id,
        averageRank: hm.averageRank,
        visibilityScore: hm.visibilityScore,
        gridSize: hm.gridSize,
        cells: hm.cells,
        status: "ready",
      });
    }
  }

  // Fill placeholders for requested keywords without scans yet
  let requested = (auditRow?.keywords ?? []).filter(Boolean).slice(0, 3);
  if (!requested.length) {
    const { data: bizKeywords } = await supabase
      .from("business_keywords")
      .select("keyword, is_primary, sort_order")
      .eq("business_id", businessId)
      .order("sort_order", { ascending: true })
      .limit(3);
    const sorted = [...(bizKeywords ?? [])].sort((a, b) => {
      if (a.is_primary === b.is_primary) {
        return Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0);
      }
      return a.is_primary ? -1 : 1;
    });
    requested = sorted.map((k) => String(k.keyword ?? "").trim()).filter(Boolean).slice(0, 3);
  }
  for (const kw of requested) {
    if (keywordGrids.some((g) => g.keyword.toLowerCase() === kw.toLowerCase())) continue;
    if (keywordGrids.length >= 3) break;
    keywordGrids.push({
      keyword: kw,
      scanId: null,
      averageRank: null,
      visibilityScore: null,
      gridSize: 7,
      cells: [],
      status: auditRow?.status === "running" ? "running" : "missing",
    });
  }

  const avgRank =
    keywordGrids.map((g) => g.averageRank).find((n) => n != null) ?? null;

  // Competitors + prospect photo from Maps/DataForSEO listing payloads
  const competitors: ProspectAuditCompetitor[] = [];
  let businessPhotoUrl: string | null = null;
  const latestScanId = keywordGrids.find((g) => g.scanId)?.scanId ?? null;
  const bizPlaceId = (business.place_id as string | null) ?? null;
  const bizCid = (business.cid as string | null) ?? null;
  const bizNameNorm = String(business.name ?? "")
    .trim()
    .toLowerCase();

  function isTargetListing(t: StoredCompetitor): boolean {
    if (bizPlaceId && t.place_id && t.place_id === bizPlaceId) return true;
    if (bizCid && t.cid && t.cid === bizCid) return true;
    const n = String(t.name ?? "")
      .trim()
      .toLowerCase();
    return Boolean(n && bizNameNorm && n === bizNameNorm);
  }

  if (latestScanId) {
    try {
      const data = await loadScanGridData(supabase, latestScanId);
      if (data) {
        type Agg = {
          listing: StoredCompetitor;
          appearances: number;
          ranks: number[];
        };
        const counts = new Map<string, Agg>();

        for (const r of data.results ?? []) {
          const tops = (r.top_competitors_json ?? []) as StoredCompetitor[];
          for (const t of tops) {
            if (isTargetListing(t)) {
              if (!businessPhotoUrl && t.main_image) {
                businessPhotoUrl = String(t.main_image);
              }
              continue;
            }
            const name = String(t.name ?? "").trim();
            if (!name) continue;
            const key = String(t.place_id || t.cid || name).toLowerCase();
            const cur = counts.get(key) ?? {
              listing: { ...t, name },
              appearances: 0,
              ranks: [],
            };
            cur.appearances += 1;
            if (typeof t.rank === "number") cur.ranks.push(t.rank);
            // Prefer richer listing fields as we see them
            cur.listing = {
              ...cur.listing,
              ...Object.fromEntries(
                Object.entries(t).filter(([, v]) => v != null && v !== "")
              ),
              name,
            };
            counts.set(key, cur);
          }
        }

        const ranked = [...counts.values()]
          .sort((a, b) => b.appearances - a.appearances)
          .slice(0, 5);

        for (const c of ranked) {
          const t = c.listing;
          const arp =
            c.ranks.length > 0
              ? round1(c.ranks.reduce((s, n) => s + n, 0) / c.ranks.length)
              : null;
          const score = Math.max(
            5,
            Math.min(
              99,
              Math.round(100 - (arp ?? 12) * 4 + c.appearances)
            )
          );
          const website =
            (t.url as string | undefined)?.trim() ||
            (t.domain ? `https://${String(t.domain).replace(/^https?:\/\//, "")}` : null) ||
            null;
          competitors.push({
            name: String(t.name ?? "Competitor"),
            score,
            rating: t.rating ?? null,
            reviewCount: t.review_count ?? null,
            address: t.address ?? null,
            category: t.category ?? null,
            phone: t.phone ?? null,
            website,
            domain: t.domain ?? null,
            mainImage: t.main_image ?? null,
            totalPhotos: t.total_photos ?? null,
            placeId: t.place_id ?? null,
            cid: t.cid ?? null,
            mapsUrl:
              mapsUrlFromPlaceId(t.place_id ?? null) ??
              (t.cid
                ? `https://www.google.com/maps?cid=${encodeURIComponent(t.cid)}`
                : null),
            lat: t.lat ?? null,
            lng: t.lng ?? null,
            appearances: c.appearances,
            avgRank: arp,
          });
        }
      }
    } catch {
      /* ignore */
    }
  }

  // Fallback: pull prospect photo from any ready scan if still missing
  if (!businessPhotoUrl) {
    for (const g of keywordGrids) {
      if (!g.scanId || businessPhotoUrl) continue;
      try {
        const data = await loadScanGridData(supabase, g.scanId);
        for (const r of data?.results ?? []) {
          const tops = (r.top_competitors_json ?? []) as StoredCompetitor[];
          const hit = tops.find((t) => isTargetListing(t) && t.main_image);
          if (hit?.main_image) {
            businessPhotoUrl = String(hit.main_image);
            break;
          }
        }
      } catch {
        /* ignore */
      }
    }
  }

  const competitorReviews = competitors[0]?.reviewCount ?? null;
  const missedRevenueYear = estimateMissedRevenue({
    seoScore,
    avgRank,
    reviewCount,
    competitorReviews,
  });

  const trustScore = sections?.overview?.scanScores?.trust ?? null;
  const trustIndicators =
    trustScore != null
      ? Math.max(1, Math.round(trustScore / 10))
      : reviewCount != null
        ? Math.min(10, Math.max(1, Math.round((reviewCount > 50 ? 6 : 3) + (rating ?? 0))))
        : null;

  const directoriesFound =
    sections?.localCoverage?.opportunities?.length != null
      ? sections.localCoverage.opportunities.length * 120 +
        (sections.localCoverage.neighborhoods?.length ?? 0) * 40
      : keywordGrids[0]?.visibilityScore != null
        ? Math.round((keywordGrids[0].visibilityScore / 100) * 2000)
        : null;

  const trustLabel =
    trustScore == null
      ? "Not scored yet"
      : trustScore >= 70
        ? "Strong trust signals"
        : trustScore >= 45
          ? "Improvement needed"
          : "Critical gaps";

  const summary =
    sections?.overview?.aiSummary?.trim() ||
    (seoScore != null
      ? `Presence is ${seoScore >= 55 ? "visible" : "limited"}, but critical gaps are holding back local rankings and leads. This audit highlights where competitors are winning and where ${business.name} is leaving revenue on the table.`
      : `Run the prospect audit to score SEO health, Maps visibility, and competitor gaps for ${business.name}.`);

  const factors = buildFactors(sections);

  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", business.organization_id)
    .maybeSingle();

  const orgPhone: string | null = null;

  let status: ProspectAuditReport["status"] = "idle";
  if (auditRow?.status) status = auditRow.status as ProspectAuditReport["status"];
  else if (growth || keywordGrids.some((g) => g.status === "ready")) status = "ready";

  const checklist = [
    { id: "seo", label: "SEO Health", done: seoScore != null },
    { id: "technical", label: "Technical Audit", done: Boolean(sections?.website) },
    { id: "gbp", label: "GBP / GMB Profile", done: Boolean(sections?.gbp) },
    { id: "maps", label: "Maps Visibility Grid", done: keywordGrids.some((g) => g.cells.length) },
    { id: "competitors", label: "Competitor Benchmark", done: competitors.length > 0 },
    { id: "reviews", label: "Reviews Snapshot", done: reviewCount != null },
  ];

  return {
    auditId: auditRow?.id ?? null,
    status,
    business: {
      id: business.id,
      name: business.name,
      address:
        (business.address_text as string | null)?.trim() ||
        (business.scan_center_label as string | null)?.trim() ||
        null,
      phone: (business.phone as string | null) ?? gbpProfile?.phone ?? null,
      website:
        (business.website_url as string | null) ?? gbpProfile?.website ?? null,
      photoUrl: businessPhotoUrl,
      rating,
      reviewCount,
      lat: (business.scan_center_lat as number | null) ?? null,
      lng: (business.scan_center_lng as number | null) ?? null,
      primaryCategory:
        (business.primary_category as string | null) ??
        gbpProfile?.primaryCategory ??
        null,
    },
    metrics: {
      seoScore,
      missedRevenueYear,
      trustIndicators,
      trustLabel,
      directoriesFound,
    },
    summary,
    factors,
    competitors,
    reviews: {
      google: reviewCount,
      facebook: null,
      yelp: null,
      rating,
    },
    keywordGrids,
    checklist,
    scanInfo: {
      startedAt: auditRow?.started_at ?? growth?.started_at ?? null,
      finishedAt: auditRow?.finished_at ?? growth?.finished_at ?? null,
      keywords: requested.length
        ? requested
        : keywordGrids.map((g) => g.keyword).filter(Boolean),
    },
    org: {
      name: (org?.name as string | null) ?? null,
      phone: orgPhone,
    },
    growthAuditId: growth?.id ?? auditRow?.growth_audit_run_id ?? null,
    latestScanId,
    errorMessage: auditRow?.error_message ?? growth?.error_message ?? null,
  };
}
