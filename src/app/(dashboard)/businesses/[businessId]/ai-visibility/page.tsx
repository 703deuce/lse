import { AiVisibilityDashboard } from "@/components/ai-visibility/ai-visibility-dashboard";
import { requireAuth } from "@/lib/auth/context";
import { getBusiness } from "@/lib/db/queries";
import { notFound } from "next/navigation";

export default async function AiVisibilityPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const auth = await requireAuth();
  const business = await getBusiness(businessId, auth.organizationId);
  if (!business) notFound();

  return <AiVisibilityDashboard businessId={businessId} />;
}
