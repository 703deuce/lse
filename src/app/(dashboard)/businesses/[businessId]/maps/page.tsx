import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { MapsOverviewDashboard } from "@/components/maps/maps-overview-dashboard";
import { requireBusinessPageData } from "@/lib/auth/require-business-page";
import { createServiceClient } from "@/lib/db/client";
import { aggregateCompetitors } from "@/lib/maps/grid";
import { USABLE_SCAN_STATUSES } from "@/lib/scans/status";

function top3Pct(metrics: {
  top3Cells?: number | null;
  totalCells?: number | null;
} | null): number | null {
  if (metrics?.top3Cells == null || !metrics.totalCells) return null;
  return Math.round((Number(metrics.top3Cells) / Number(metrics.totalCells)) * 1000) / 10;
}

function top10Pct(metrics: {
  top10Cells?: number | null;
  totalCells?: number | null;
  visibilityScore?: number | null;
} | null): number | null {
  if (!metrics) return null;
  if (metrics.visibilityScore != null) return Number(metrics.visibilityScore);
  if (metrics.top10Cells == null || !metrics.totalCells) return null;
  return Math.round((Number(metrics.top10Cells) / Number(metrics.totalCells)) * 1000) / 10;
}

async function MapsOverviewLoaded({ businessId }: { businessId: string }) {
  const { business } = await requireBusinessPageData(businessId);
  const supabase = createServiceClient();

  const [{ data: scans }, { data: keywords }, { data: campaigns }] = await Promise.all([
    supabase
      .from("scan_batches")
      .select(
        "id, status, grid_size, radius_meters, created_at, finished_at, center_label, aggregate_metrics, confidence_summary"
      )
      .eq("business_id", businessId)
      .in("status", [...USABLE_SCAN_STATUSES])
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("business_keywords")
      .select("id, keyword, is_primary, active")
      .eq("business_id", businessId)
      .neq("active", false)
      .order("is_primary", { ascending: false }),
    supabase
      .from("maps_campaigns")
      .select("next_scheduled_at, schedule_enabled, status")
      .eq("business_id", businessId)
      .eq("schedule_enabled", true)
      .order("next_scheduled_at", { ascending: true })
      .limit(5),
  ]);

  if (!scans?.length) {
    redirect(`/businesses/${businessId}/local-visibility`);
  }

  const keywordById = new Map(
    (keywords ?? []).map((k) => [k.id as string, String(k.keyword).trim()])
  );

  const scanItems = (scans ?? []).map((scan) => {
    const conf = (scan.confidence_summary ?? {}) as {
      keyword_label?: string;
      keyword_ids?: string[];
    };
    const keywordId = conf.keyword_ids?.[0] ?? null;
    const keyword =
      conf.keyword_label ??
      (keywordId ? keywordById.get(keywordId) : null) ??
      null;
    const metrics = (scan.aggregate_metrics ?? null) as {
      averageRank?: number | null;
      top3Cells?: number;
      top10Cells?: number;
      totalCells?: number;
      visibilityScore?: number | null;
    } | null;

    return {
      id: scan.id as string,
      status: scan.status as string,
      createdAt: scan.created_at as string,
      finishedAt: (scan.finished_at as string | null) ?? null,
      keyword,
      keywordId,
      averageRank:
        metrics?.averageRank != null ? Number(metrics.averageRank) : null,
      top3Pct: top3Pct(metrics),
      top10Pct: top10Pct(metrics),
      visibilityScore:
        metrics?.visibilityScore != null ? Number(metrics.visibilityScore) : null,
      centerLabel: (scan.center_label as string | null) ?? null,
      gridSize: Number(scan.grid_size ?? 0),
      radiusMeters: Number(scan.radius_meters ?? 0),
    };
  });

  const latestScan = scanItems[0] ?? null;
  const previousScan = scanItems[1] ?? null;

  const scansByKeywordId = new Map<string, typeof scanItems>();
  for (const scan of scanItems) {
    if (!scan.keywordId) continue;
    const list = scansByKeywordId.get(scan.keywordId) ?? [];
    list.push(scan);
    scansByKeywordId.set(scan.keywordId, list);
  }

  const keywordMovement = (keywords ?? []).map((k) => {
    const id = k.id as string;
    const keywordScans = scansByKeywordId.get(id) ?? [];
    const latest = keywordScans[0] ?? null;
    const previous = keywordScans[1] ?? null;
    const change =
      latest?.averageRank != null && previous?.averageRank != null
        ? Math.round((previous.averageRank - latest.averageRank) * 10) / 10
        : null;
    return {
      keyword: String(k.keyword).trim(),
      keywordId: id,
      latestAvgRank: latest?.averageRank ?? null,
      previousAvgRank: previous?.averageRank ?? null,
      change,
      latestTop3Pct: latest?.top3Pct ?? null,
      latestScanId: latest?.id ?? null,
    };
  });

  let topCompetitorLabels: string[] = [];
  let heatmapCells: Array<{ rank: number | null; label?: string }> = [];

  if (latestScan) {
    const { data: points } = await supabase
      .from("scan_points")
      .select("id, grid_label")
      .eq("scan_batch_id", latestScan.id)
      .order("grid_label", { ascending: true });
    const pointIds = (points ?? []).map((p) => p.id as string);
    if (pointIds.length) {
      const { data: results } = await supabase
        .from("scan_results")
        .select("scan_point_id, target_rank, target_found, top_competitors_json")
        .in("scan_point_id", pointIds);
      const rankByPoint = new Map<string, number | null>();
      for (const r of results ?? []) {
        const pid = String(r.scan_point_id);
        if (!rankByPoint.has(pid)) {
          rankByPoint.set(
            pid,
            r.target_found === false
              ? null
              : r.target_rank != null
                ? Number(r.target_rank)
                : null
          );
        }
      }
      heatmapCells = (points ?? []).map((p) => ({
        rank: rankByPoint.get(String(p.id)) ?? null,
        label: String(p.grid_label ?? ""),
      }));

      const competitors = aggregateCompetitors(results ?? [], {
        excludeCid: business.cid,
        excludePlaceId: business.place_id,
        excludeName: business.name,
        targetCategory: business.primary_category,
      });
      topCompetitorLabels = competitors
        .map((c) => (c.name ?? "").trim())
        .filter(Boolean)
        .slice(0, 5);
    }
  }

  const nextScheduledAt =
    (campaigns ?? [])
      .map((c) => c.next_scheduled_at as string | null)
      .find((d) => d != null) ?? null;

  return (
    <MapsOverviewDashboard
      businessId={businessId}
      businessName={String(business.name ?? "Business")}
      latestScan={latestScan}
      previousScan={previousScan}
      keywordMovement={keywordMovement}
      nextScheduledAt={nextScheduledAt}
      topCompetitorLabels={topCompetitorLabels}
      heatmapCells={heatmapCells}
      keywordsTracked={(keywords ?? []).length}
    />
  );
}

export default async function MapsOverviewPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[400px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#137752]" />
        </div>
      }
    >
      <MapsOverviewLoaded businessId={businessId} />
    </Suspense>
  );
}
