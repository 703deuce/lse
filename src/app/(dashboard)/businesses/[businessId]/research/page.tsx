import { ResearchPanel } from "@/components/research/research-panel";

export default async function ResearchPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  return <ResearchPanel businessId={businessId} />;
}
