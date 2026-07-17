import { requireBusinessPageData } from "@/lib/auth/require-business-page";
import { PageHeader } from "@/components/ui/page-header";
import { createServiceClient } from "@/lib/db/client";
import { ScansHub } from "@/components/scan/scans-hub";

export default async function ScansPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const { business } = await requireBusinessPageData(businessId);

  const supabase = createServiceClient();

  const [{ data: scans }, { data: keywords }] = await Promise.all([
    supabase
      .from("scan_batches")
      .select(
        "id, status, grid_size, radius_meters, created_at, finished_at, center_label, aggregate_metrics, confidence_summary"
      )
      .eq("business_id", businessId)
      .order("created_at", { ascending: false }),
    supabase
      .from("business_keywords")
      .select("id, keyword, is_primary")
      .eq("business_id", businessId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true }),
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

  return (
    <>
      <PageHeader
        title="Maps Scans"
        subtitle="Configure your local search grid, exclude unused points, then run — nothing bills until you click Run scan."
        className="[&_h1]:text-xl [&_p]:text-[13px] [&_p]:leading-snug"
      />

      <div className="mt-4">
        <ScansHub
          businessId={businessId}
          scans={scanItems}
          keywords={(keywords ?? []).map((k) => ({
            id: k.id as string,
            keyword: String(k.keyword).trim(),
            is_primary: !!k.is_primary,
          }))}
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
      </div>
    </>
  );
}
