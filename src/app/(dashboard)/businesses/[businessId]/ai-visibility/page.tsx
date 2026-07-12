import { AiVisibilityDashboard } from "@/components/ai-visibility/ai-visibility-dashboard";

export default async function AiVisibilityPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  return <AiVisibilityDashboard businessId={businessId} />;
}
