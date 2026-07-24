import { WebhooksClient } from "@/components/integrations/webhooks-client";

export default async function ReputationAutomationsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  return <WebhooksClient businessId={businessId} />;
}
