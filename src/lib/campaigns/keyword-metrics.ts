import type { createServiceClient } from "@/lib/db/client";
import { computeAggregateMetrics } from "@/lib/maps/grid";
import { computeSolv } from "@/lib/maps/grid-metrics";
import { round1 } from "@/lib/reporting/metrics";

type ServiceClient = ReturnType<typeof createServiceClient>;

export type CampaignKeywordMetrics = {
  id: string;
  keyword: string;
  is_primary: boolean;
  active: boolean;
  sort_order: number;
  created_at: string | null;
  latestAverage: number | null;
  top3Pct: number | null;
  previousChange: number | null;
  lastScanAt: string | null;
  latestScanId: string | null;
  previousScanId: string | null;
  status: "never_scanned" | "running" | "ready" | "stale" | "paused";
};

type BatchLite = {
  id: string;
  created_at: string | null;
  finished_at: string | null;
  status: string | null;
  aggregate_metrics: {
    averageRank?: number | null;
    top3Cells?: number | null;
    totalCells?: number | null;
  } | null;
  confidence_summary?: {
    keyword_ids?: string[];
    keyword_label?: string;
  } | null;
};

async function metricsFromBatch(
  supabase: ServiceClient,
  batch: BatchLite,
  keywordId: string
): Promise<{ average: number | null; top3Pct: number | null }> {
  const agg = batch.aggregate_metrics;
  if (agg?.averageRank != null && agg.top3Cells != null && agg.totalCells) {
    return {
      average: round1(agg.averageRank),
      top3Pct: computeSolv(agg.top3Cells, agg.totalCells),
    };
  }

  const { data: points } = await supabase
    .from("scan_points")
    .select("id")
    .eq("scan_batch_id", batch.id);
  const pointIds = (points ?? []).map((p) => p.id);
  if (!pointIds.length) return { average: null, top3Pct: null };

  const { data: results } = await supabase
    .from("scan_results")
    .select("target_rank")
    .in("scan_point_id", pointIds)
    .eq("keyword_id", keywordId);

  const ranks = (results ?? []).map((r) => r.target_rank as number | null);
  if (!ranks.length) return { average: null, top3Pct: null };
  const metrics = computeAggregateMetrics(ranks);
  return {
    average: metrics.averageRank ?? null,
    top3Pct: computeSolv(metrics.top3Cells, metrics.totalCells),
  };
}

/**
 * Enrich campaign keywords with Latest avg / Top 3 / Δ / Last scan for the ops table.
 */
export async function loadCampaignKeywordMetrics(
  supabase: ServiceClient,
  params: {
    businessId: string;
    campaignId: string;
    gridSize: number;
    radiusMeters: number;
  }
): Promise<CampaignKeywordMetrics[]> {
  const { data: keywords } = await supabase
    .from("business_keywords")
    .select("id, keyword, is_primary, active, sort_order, created_at")
    .eq("campaign_id", params.campaignId)
    .order("sort_order", { ascending: true });

  const keywordList = keywords ?? [];
  if (!keywordList.length) return [];

  const keywordIds = new Set(keywordList.map((k) => k.id as string));

  const { data: batches } = await supabase
    .from("scan_batches")
    .select(
      "id, created_at, finished_at, status, aggregate_metrics, confidence_summary, grid_size, radius_meters"
    )
    .eq("business_id", params.businessId)
    .eq("grid_size", params.gridSize)
    .eq("radius_meters", params.radiusMeters)
    .in("status", ["ready", "partial", "rank_ready", "processing", "queued", "recovering"])
    .order("created_at", { ascending: false })
    .limit(120);

  const byKeyword = new Map<string, BatchLite[]>();
  for (const batch of batches ?? []) {
    const conf = (batch.confidence_summary ?? {}) as {
      keyword_ids?: string[];
    };
    const ids = Array.isArray(conf.keyword_ids) ? conf.keyword_ids : [];
    for (const kid of ids) {
      if (!keywordIds.has(kid)) continue;
      const list = byKeyword.get(kid) ?? [];
      list.push(batch as BatchLite);
      byKeyword.set(kid, list);
    }
  }

  const rows: CampaignKeywordMetrics[] = [];
  const staleMs = 45 * 86400000;

  for (const kw of keywordList) {
    const active = kw.active !== false;
    const matched = byKeyword.get(kw.id as string) ?? [];
    const running = matched.find((b) =>
      ["processing", "queued", "recovering"].includes(String(b.status ?? ""))
    );
    const ready = matched.filter((b) =>
      ["ready", "partial", "rank_ready"].includes(String(b.status ?? ""))
    );
    const latest = ready[0] ?? null;
    const previous = ready[1] ?? null;

    let latestAverage: number | null = null;
    let top3Pct: number | null = null;
    let previousChange: number | null = null;

    if (latest) {
      const m = await metricsFromBatch(supabase, latest, kw.id as string);
      latestAverage = m.average;
      top3Pct = m.top3Pct;
      if (previous && latestAverage != null) {
        const prev = await metricsFromBatch(supabase, previous, kw.id as string);
        if (prev.average != null) {
          previousChange = round1(prev.average - latestAverage);
        }
      }
    }

    const lastScanAt = latest?.finished_at ?? latest?.created_at ?? null;
    let status: CampaignKeywordMetrics["status"] = "never_scanned";
    if (!active) status = "paused";
    else if (running) status = "running";
    else if (latest) {
      const age = Date.now() - new Date(lastScanAt ?? 0).getTime();
      status = age > staleMs ? "stale" : "ready";
    }

    rows.push({
      id: kw.id as string,
      keyword: String(kw.keyword),
      is_primary: Boolean(kw.is_primary),
      active,
      sort_order: Number(kw.sort_order ?? 0),
      created_at: (kw.created_at as string | null) ?? null,
      latestAverage,
      top3Pct,
      previousChange,
      lastScanAt,
      latestScanId: latest?.id ?? null,
      previousScanId: previous?.id ?? null,
      status,
    });
  }

  return rows;
}
