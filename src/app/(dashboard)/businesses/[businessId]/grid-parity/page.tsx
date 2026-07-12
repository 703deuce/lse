import { GridParityView } from "@/components/scan/grid-parity-view";

export default async function GridParityPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  return <GridParityView businessId={businessId} />;
}
