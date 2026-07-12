import { GridScanView } from "@/components/scan/grid-scan-view";

export default async function GridScanPage({
  params,
}: {
  params: Promise<{ businessId: string; scanId: string }>;
}) {
  const { businessId, scanId } = await params;
  return <GridScanView businessId={businessId} scanId={scanId} />;
}
