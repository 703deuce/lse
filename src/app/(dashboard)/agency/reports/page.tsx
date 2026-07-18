import { PageHeader } from "@/components/ui/page-header";
import { requirePageAuth } from "@/lib/auth/context";
import { createServiceClient } from "@/lib/db/client";
import { USABLE_SCAN_STATUSES } from "@/lib/scans/status";
import Link from "next/link";

export default async function AgencyReportsPage() {
  const auth = await requirePageAuth();
  const supabase = createServiceClient();

  const { data: businesses } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("organization_id", auth.organizationId)
    .order("name", { ascending: true });

  const rows = [];
  for (const b of businesses ?? []) {
    const { data: latestScan } = await supabase
      .from("scan_batches")
      .select("id")
      .eq("business_id", b.id)
      .in("status", [...USABLE_SCAN_STATUSES])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    rows.push({
      businessId: b.id,
      businessName: b.name,
      hasScan: Boolean(latestScan),
    });
  }

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Open each client’s Reports hub to share, print PDF, or export CSV"
      />

      <div className="space-y-3">
        {rows.map((r) => (
          <div
            key={r.businessId}
            className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200/80 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
          >
            <div className="min-w-0">
              <span className="font-medium">{r.businessName}</span>
              <p className="mt-0.5 text-xs text-zinc-500">
                {r.hasScan
                  ? "Maps + Reviews reports available"
                  : "Reviews / Review Campaign reports available (no usable scan yet)"}
              </p>
            </div>
            <Link
              href={`/businesses/${r.businessId}/reports`}
              className="shrink-0 text-sm text-emerald-600 hover:underline"
            >
              Open reports →
            </Link>
          </div>
        ))}
        {!rows.length && <p className="text-zinc-500">No client businesses yet.</p>}
      </div>
    </>
  );
}
