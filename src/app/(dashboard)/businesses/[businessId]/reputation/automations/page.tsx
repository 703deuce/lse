import { AutomationsHub } from "@/components/reputation/automations-hub";

export default async function ReputationAutomationsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  return <AutomationsHub businessId={businessId} />;
}
