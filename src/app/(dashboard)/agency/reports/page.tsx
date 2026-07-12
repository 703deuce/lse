import { PageHeader } from "@/components/ui/page-header";
import { requireAuth } from "@/lib/auth/context";
import { createServiceClient } from "@/lib/db/client";
import Link from "next/link";

export default async function AgencyReportsPage() {
  const auth = await requireAuth();
  const supabase = createServiceClient();

  const { data: businesses } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("organization_id", auth.organizationId);

  const reports = [];
  for (const b of businesses ?? []) {
    const { data: latestScan } = await supabase
      .from("scan_batches")
      .select("id")
      .eq("business_id", b.id)
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestScan) {
      reports.push({ businessId: b.id, businessName: b.name, scanId: latestScan.id });
    }
  }

  return (
    <>
      <PageHeader
        title="Agency — Reports"
        subtitle="Bulk export visibility reports for all clients"
      />

      <div className="space-y-3">
        {reports.map((r) => (
          <div
            key={r.businessId}
            className="flex items-center justify-between rounded-xl border border-zinc-200/80 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
          >
            <span className="font-medium">{r.businessName}</span>
            <Link href={`/businesses/${r.businessId}/reports`} className="text-sm text-emerald-600 hover:underline">
              Export report →
            </Link>
          </div>
        ))}
        {!reports.length && <p className="text-zinc-500">No completed scans to report on yet.</p>}
      </div>
    </>
  );
}
