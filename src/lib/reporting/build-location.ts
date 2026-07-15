import { createServiceClient } from "@/lib/db/client";
import type { BusinessRow, ScanBatchRow } from "@/lib/db/types";
import {
  buildEntityGridCells,
  buildYouEntity,
} from "@/lib/maps/grid-entity";
import { loadScanGridData } from "@/lib/maps/scan-queries";
import {
  kpisFromRanks,
  pct,
  round1,
} from "@/lib/reporting/metrics";
import { resolveOrgWhiteLabel } from "@/lib/reporting/white-label";
import type {
  LocationReportPayload,
  ReportKpis,
  WhiteLabelConfig,
} from "@/lib/reporting/types";

type KeywordMetric = LocationReportPayload["keywords"][number];

function emptyKpis(): ReportKpis {
  return {
    arp: null,
    atrp: null,
    solv: 0,
    top3Pct: 0,
    top10Pct: 0,
    notFoundPct: 0,
    visibilityScore: 0,
    bestRank: null,
    worstRank: null,
    totalCells: 0,
    foundCells: 0,
  };
}

function aggregateKeywordKpis(rows: KeywordMetric[]): ReportKpis {
  const withArp = rows.filter((r) => r.arp != null);
  const withAtrp = rows.filter((r) => r.atrp != null);
  const withSolv = rows.filter((r) => r.solv != null);
  const arp =
    withArp.length > 0
      ? round1(withArp.reduce((s, r) => s + (r.arp as number), 0) / withArp.length)
      : null;
  const atrp =
    withAtrp.length > 0
      ? round1(withAtrp.reduce((s, r) => s + (r.atrp as number), 0) / withAtrp.length)
      : null;
  const solv =
    withSolv.length > 0
      ? Math.round(
          (withSolv.reduce((s, r) => s + (r.solv as number), 0) / withSolv.length) * 100
        ) / 100
      : 0;

  return {
    ...emptyKpis(),
    arp,
    atrp,
    solv,
    top3Pct: solv,
    visibilityScore: Math.round(solv),
    totalCells: rows.length,
    foundCells: withArp.length,
  };
}

async function metricsForBatch(
  supabase: ReturnType<typeof createServiceClient>,
  scanId: string,
  keywordId: string | null,
  business: BusinessRow
): Promise<{ arp: number | null; atrp: number | null; solv: number | null }> {
  const gridData = await loadScanGridData(supabase, scanId, keywordId);
  if (!gridData) {
    return { arp: null, atrp: null, solv: null };
  }
  const you = buildYouEntity((gridData.business ?? business) as BusinessRow);
  const cells = buildEntityGridCells(gridData.points, gridData.results, you);
  const ranks = cells.map((c) => (c.pending ? null : c.notInResults ? null : c.rank));
  const kpis = kpisFromRanks(ranks);
  return { arp: kpis.arp, atrp: kpis.atrp, solv: kpis.solv };
}

export async function buildLocationReport(params: {
  businessId: string;
  whiteLabel?: Partial<WhiteLabelConfig>;
}): Promise<LocationReportPayload> {
  const supabase = createServiceClient();

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", params.businessId)
    .single();
  if (!business) throw new Error("Business not found");

  const { data: batches } = await supabase
    .from("scan_batches")
    .select(
      "id, created_at, finished_at, status, aggregate_metrics, confidence_summary, grid_size, radius_meters"
    )
    .eq("business_id", params.businessId)
    .in("status", ["ready", "partial", "rank_ready"])
    .order("created_at", { ascending: false })
    .limit(80);

  const byKeyword = new Map<
    string,
    Array<{
      scanId: string;
      scannedAt: string;
      keywordId: string | null;
      keyword: string;
      metrics: { averageRank?: number | null; top3Cells?: number; totalCells?: number; visibilityScore?: number };
    }>
  >();

  for (const batch of (batches ?? []) as ScanBatchRow[]) {
    const conf = (batch.confidence_summary ?? {}) as {
      keyword_label?: string;
      keyword_ids?: string[];
    };
    const keywordId = conf.keyword_ids?.[0] ?? null;
    const keyword = conf.keyword_label?.trim() || "Unknown keyword";
    const key = keywordId ?? keyword.toLowerCase();
    const list = byKeyword.get(key) ?? [];
    list.push({
      scanId: batch.id,
      scannedAt: batch.finished_at ?? batch.created_at,
      keywordId,
      keyword,
      metrics: (batch.aggregate_metrics ?? {}) as {
        averageRank?: number | null;
        top3Cells?: number;
        totalCells?: number;
        visibilityScore?: number;
      },
    });
    byKeyword.set(key, list);
  }

  const keywords: KeywordMetric[] = [];

  for (const [, scans] of byKeyword) {
    // batches query is descending; keep that order (newest first)
    const latest = scans[0]!;
    const previous = scans[1];

    let latestMetrics = {
      arp: round1(latest.metrics.averageRank ?? null),
      atrp: round1(latest.metrics.averageRank ?? null),
      solv:
        latest.metrics.top3Cells != null && latest.metrics.totalCells
          ? pct(latest.metrics.top3Cells, latest.metrics.totalCells)
          : null,
    };

    // Recompute precise KPIs for latest (and previous when present).
    const recomputed = await metricsForBatch(
      supabase,
      latest.scanId,
      latest.keywordId,
      business as BusinessRow
    );
    if (recomputed.arp != null || recomputed.solv != null) {
      latestMetrics = recomputed;
    }

    let changeArp: number | null = null;
    if (previous) {
      const prevRecomputed = await metricsForBatch(
        supabase,
        previous.scanId,
        previous.keywordId,
        business as BusinessRow
      );
      const prevArp =
        prevRecomputed.arp ?? round1(previous.metrics.averageRank ?? null);
      if (latestMetrics.arp != null && prevArp != null) {
        // Positive = improved (lower ARP)
        changeArp = Math.round((prevArp - latestMetrics.arp) * 10) / 10;
      }
    }

    keywords.push({
      keyword: latest.keyword,
      keywordId: latest.keywordId,
      scanId: latest.scanId,
      scannedAt: latest.scannedAt,
      arp: latestMetrics.arp,
      atrp: latestMetrics.atrp,
      solv: latestMetrics.solv,
      changeArp,
    });
  }

  keywords.sort((a, b) => (a.arp ?? 99) - (b.arp ?? 99));

  const rising = keywords
    .filter((k) => k.changeArp != null && k.changeArp > 0)
    .sort((a, b) => (b.changeArp ?? 0) - (a.changeArp ?? 0))
    .map((k) => k.keyword);
  const falling = keywords
    .filter((k) => k.changeArp != null && k.changeArp < 0)
    .sort((a, b) => (a.changeArp ?? 0) - (b.changeArp ?? 0))
    .map((k) => k.keyword);

  const dates = keywords
    .map((k) => k.scannedAt)
    .filter((d): d is string => !!d)
    .sort();

  const whiteLabel = await resolveOrgWhiteLabel(
    supabase,
    business as BusinessRow,
    params.whiteLabel
  );

  return {
    reportType: "location",
    business: {
      id: business.id,
      name: business.name,
      address: business.address_text ?? null,
    },
    parameters: {
      dateFrom: dates[0] ?? new Date().toISOString(),
      dateTo: dates[dates.length - 1] ?? new Date().toISOString(),
      keywordCount: keywords.length,
    },
    aggregate: aggregateKeywordKpis(keywords),
    keywords,
    rising,
    falling,
    whiteLabel,
    generatedAt: new Date().toISOString(),
  };
}
