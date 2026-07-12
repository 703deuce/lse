import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/design-system";
import { requireAuth } from "@/lib/auth/context";
import { getBusiness } from "@/lib/db/queries";
import { createServiceClient } from "@/lib/db/client";
import { StatusBadge } from "@/components/ui/metric-card";
import { RunScanButton } from "@/components/scan/run-scan-button";
import { notFound } from "next/navigation";

function formatScanDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRadius(meters: number): string {
  const miles = meters / 1609.34;
  return miles >= 1 ? `${Math.round(miles)} mi radius` : `${meters} m radius`;
}

export default async function ScansPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const auth = await requireAuth();
  const business = await getBusiness(businessId, auth.organizationId);
  if (!business) notFound();

  const supabase = createServiceClient();
  const { data: scans } = await supabase
    .from("scan_batches")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  return (
    <>
      <PageHeader
        title="Scans"
        subtitle="Every grid scan you've run — open one to see the full rank map."
        actions={<RunScanButton businessId={businessId} />}
      />

      <div className="space-y-3">
        {(scans ?? []).map((scan) => {
          const metrics = (scan.aggregate_metrics ?? {}) as Record<string, number | null>;
          return (
            <Link
              key={scan.id}
              href={`/businesses/${businessId}/grid/${scan.id}`}
              className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition hover:border-emerald-200 hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
            >
              <div className="min-w-0">
                <p className="font-semibold text-zinc-900">
                  {scan.grid_size}×{scan.grid_size} grid · {formatRadius(scan.radius_meters)}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-zinc-500">
                  {formatScanDate(scan.created_at)}
                  {metrics.averageRank != null && ` · Avg rank ${metrics.averageRank}`}
                </p>
              </div>
              <StatusBadge status={scan.status} />
            </Link>
          );
        })}
        {!scans?.length && (
          <EmptyState
            title="No scans yet"
            description="Run your first grid scan to map your Google Maps rankings across your service area."
          />
        )}
      </div>
    </>
  );
}
