import { LocalTrustDashboard } from "@/components/local-trust/local-trust-dashboard";
import { requireAuth } from "@/lib/auth/context";
import { getBusiness } from "@/lib/db/queries";
import { notFound } from "next/navigation";

export default async function TrustPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const auth = await requireAuth();
  const business = await getBusiness(businessId, auth.organizationId);
  if (!business) notFound();

  return <LocalTrustDashboard businessId={businessId} />;
}
