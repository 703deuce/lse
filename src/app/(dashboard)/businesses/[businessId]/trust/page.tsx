import { LocalTrustDashboard } from "@/components/local-trust/local-trust-dashboard";

export default async function TrustPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  return <LocalTrustDashboard businessId={businessId} />;
}