import { GridScanDebugView } from "@/components/scan/grid-scan-debug-view";

export default async function GridScanDebugPage({
  params,
}: {
  params: Promise<{ businessId: string; scanId: string }>;
}) {
  const { businessId, scanId } = await params;
  return <GridScanDebugView businessId={businessId} scanId={scanId} />;
}
