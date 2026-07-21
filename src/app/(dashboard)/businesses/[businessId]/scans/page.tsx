import { requireBusinessPageData } from "@/lib/auth/require-business-page";
import { ModuleHeader, ModulePage } from "@/components/ui/design-system";
import { createServiceClient } from "@/lib/db/client";
import { ScansHub } from "@/components/scan/scans-hub";
import { Grid3X3 } from "lucide-react";

function top3Pct(metrics: { top3Cells?: number | null; totalCells?: number | null } | null): number | null {
  if (metrics?.top3Cells == null || !metrics.totalCells) return null;
  return Math.round((Number(metrics.top3Cells) / Number(metrics.totalCells)) * 100);
}

export default async function ScansPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const { business } = await requireBusinessPageData(businessId);

  const supabase = createServiceClient();

  const [{ data: scans }, { data: keywords }, { data: trackedKeywords }] = await Promise.all([
    supabase
      .from("scan_batches")
      .select(
        "id, status, grid_size, radius_meters, created_at, finished_at, center_label, aggregate_metrics, confidence_summary"
      )
      .eq("business_id", businessId)
      .order("created_at", { ascending: false }),
    supabase
      .from("business_keywords")
      .select("id, keyword, is_primary, active")
      .eq("business_id", businessId)
      .neq("active", false)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true }),
    supabase
      .from("tracked_keywords")
      .select("keyword, search_volume")
      .eq("business_id", businessId)
      .eq("active", true),
  ]);

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
      (keywordId || conf.keyword_ids?.length ? "Historical scan" : null);

    return {
      id: scan.id as string,
      status: scan.status as string,
      grid_size: scan.grid_size as number,
      radius_meters: scan.radius_meters as number,
      created_at: scan.created_at as string,
      finished_at: (scan.finished_at as string | null) ?? null,
      center_label: (scan.center_label as string | null) ?? null,
      keyword,
      keyword_id: keywordId,
      aggregate_metrics: (scan.aggregate_metrics ?? null) as {
        averageRank?: number | null;
        top3Cells?: number;
        totalCells?: number;
        visibilityScore?: number | null;
      } | null,
    };
  });

  const volumeByKeyword = new Map(
    (trackedKeywords ?? []).map((k) => [
      String(k.keyword).trim().toLowerCase(),
      (k.search_volume as number | null) ?? null,
    ])
  );
  const scansByKeywordId = new Map<string, typeof scanItems>();
  for (const scan of scanItems) {
    if (!scan.keyword_id) continue;
    const list = scansByKeywordId.get(scan.keyword_id) ?? [];
    list.push(scan);
    scansByKeywordId.set(scan.keyword_id, list);
  }

  const keywordOptions = (keywords ?? []).map((k) => {
    const id = k.id as string;
    const keyword = String(k.keyword).trim();
    const keywordScans = scansByKeywordId.get(id) ?? [];
    const latest = keywordScans[0] ?? null;
    const previous = keywordScans[1] ?? null;
    const latestMetrics = latest?.aggregate_metrics ?? null;
    const previousTop3 = top3Pct(previous?.aggregate_metrics ?? null);
    const latestTop3 = top3Pct(latestMetrics);
    const change =
      latestTop3 != null && previousTop3 != null
        ? Math.round((latestTop3 - previousTop3) * 10) / 10
        : null;

    return {
      id,
      keyword,
      is_primary: !!k.is_primary,
      search_volume: volumeByKeyword.get(keyword.toLowerCase()) ?? null,
      last_scan_at: latest?.finished_at ?? latest?.created_at ?? null,
      latest_scan_id: latest?.id ?? null,
      latest_center_label: latest?.center_label ?? null,
      latest_average_rank:
        latestMetrics?.averageRank != null ? Number(latestMetrics.averageRank) : null,
      latest_top3_pct: latestTop3,
      latest_visibility_score:
        latestMetrics?.visibilityScore != null ? Number(latestMetrics.visibilityScore) : null,
      change,
    };
  });

  return (
    <ModulePage>
      <ModuleHeader
        icon={<Grid3X3 className="h-5 w-5 shrink-0 text-emerald-600" />}
        title="Maps Scans"
        subtitle="Pick keywords, set the local search grid, then run — nothing starts until you click Run scan."
      />

      <ScansHub
        businessId={businessId}
        scans={scanItems}
        keywords={keywordOptions}
        defaultCenterLat={
          (business.scan_center_lat as number | null) ?? (business.lat as number) ?? 0
        }
        defaultCenterLng={
          (business.scan_center_lng as number | null) ?? (business.lng as number) ?? 0
        }
        defaultAddress={
          ((business.scan_center_label as string | null) ??
            (business.address_text as string | null) ??
            null)
        }
        businessName={business.name as string}
      />
    </ModulePage>
  );
}
