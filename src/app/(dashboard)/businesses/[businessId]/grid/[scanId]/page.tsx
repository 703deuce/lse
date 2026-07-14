import { GridScanView } from "@/components/scan/grid-scan-view";
import { requireAuth } from "@/lib/auth/context";
import { createServiceClient } from "@/lib/db/client";
import { getBusiness } from "@/lib/db/queries";
import { notFound } from "next/navigation";

export default async function GridScanPage({
  params,
}: {
  params: Promise<{ businessId: string; scanId: string }>;
}) {
  const { businessId, scanId } = await params;
  const auth = await requireAuth();
  const business = await getBusiness(businessId, auth.organizationId);
  if (!business) notFound();

  const supabase = createServiceClient();
  const { data: batch } = await supabase
    .from("scan_batches")
    .select("id, business_id")
    .eq("id", scanId)
    .maybeSingle();

  if (!batch || batch.business_id !== businessId) notFound();

  return <GridScanView businessId={businessId} scanId={scanId} />;
}
