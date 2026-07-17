import { notFound } from "next/navigation";
import { requireBusinessPageData } from "@/lib/auth/require-business-page";
import { GridScanView } from "@/components/scan/grid-scan-view";
import { createServiceClient } from "@/lib/db/client";

export default async function GridScanPage({
  params,
}: {
  params: Promise<{ businessId: string; scanId: string }>;
}) {
  const { businessId, scanId } = await params;
  await requireBusinessPageData(businessId);

  const supabase = createServiceClient();
  const { data: batch } = await supabase
    .from("scan_batches")
    .select("id, business_id")
    .eq("id", scanId)
    .maybeSingle();

  if (!batch || batch.business_id !== businessId) notFound();

  return <GridScanView businessId={businessId} scanId={scanId} />;
}
